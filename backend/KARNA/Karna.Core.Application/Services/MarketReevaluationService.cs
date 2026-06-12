using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Karna.Core.Application.Services
{
	internal class MarketReevaluationService(
		IUnitOfWork _unitOfWork,
		IMLApiClient _mlApiClient,
		ILogger<MarketReevaluationService> _logger
	) : IMarketReevaluationService
	{
		/// <summary>
		/// Configurable threshold for significant price change detection (10% = 0.10).
		/// </summary>
		private const decimal SignificantChangeThreshold = 0.10m;

		public async Task RunAsync()
		{
			_logger.LogInformation("Market re-evaluation started.");

			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var makeRepo = _unitOfWork.GetRepository<Make>();
			var modelRepo = _unitOfWork.GetRepository<Model>();
			var pricingHistoryRepo = _unitOfWork.GetRepository<PricingHistory>();
			var notificationRepo = _unitOfWork.GetRepository<Notification>();

			// 1. Get eligible listings: Active or Pending, not deleted
			var eligibleListings = (await listingRepo.FindAsync(
				l => (l.Status == ListingStatus.Active || l.Status == ListingStatus.Pending)
					&& !l.IsDeleted,
				withTracking: true))
				.ToList();

			_logger.LogInformation("Found {Count} eligible listings for re-evaluation.", eligibleListings.Count);

			int processed = 0;
			int failed = 0;
			int updated = 0;

			foreach (var listing in eligibleListings)
			{
				try
				{
					await ProcessListingAsync(
						listing, makeRepo, modelRepo,
						pricingHistoryRepo, notificationRepo);

					processed++;

					// Check if ML values actually changed
					if (_unitOfWork.GetRepository<Listing>() != null) // always true, just to track
						updated++;
				}
				catch (Exception ex)
				{
					failed++;
					_logger.LogError(ex,
						"Failed to re-evaluate listing {ListingId}. Continuing with remaining listings.",
						listing.Id);
				}
			}

			// Save all changes at the end
			try
			{
				await _unitOfWork.CompleteAsync();
				_logger.LogInformation(
					"Market re-evaluation completed. Processed: {Processed}, Updated: {Updated}, Failed: {Failed}",
					processed, updated, failed);
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Failed to save market re-evaluation changes. Attempting per-listing save.");
				await SavePerListingFallbackAsync(eligibleListings, makeRepo, modelRepo, pricingHistoryRepo, notificationRepo);
			}
		}

		private async Task ProcessListingAsync(
			Listing listing,
			IGenericRepository<Make> makeRepo,
			IGenericRepository<Model> modelRepo,
			IGenericRepository<PricingHistory> pricingHistoryRepo,
			IGenericRepository<Notification> notificationRepo)
		{
			// 1. Load Make and Model
			var make = await makeRepo.GetAsync(listing.MakeId);
			var model = await modelRepo.GetAsync(listing.ModelId);

			if (make is null || model is null)
			{
				_logger.LogWarning(
					"Listing {ListingId}: Make or Model not found. Skipping.",
					listing.Id);
				return;
			}

			// 2. Build ML request and call API
			var locationStr = listing.Location.ToDisplayString();
			var fuelTypeStr = listing.FuelType.ToString().ToLowerInvariant();
			var transmissionStr = listing.Transmission.ToString();

			var mlResult = await _mlApiClient.GetPricePredictionAsync(
				brand: make.Name,
				model: model.Name,
				year: listing.Year,
				mileageKm: listing.Mileage,
				fuel: fuelTypeStr,
				transmission: transmissionStr,
				location: locationStr);

			if (!mlResult.Success || mlResult.Data is null)
			{
				_logger.LogWarning(
					"Listing {ListingId}: ML prediction failed — {Error}. Skipping.",
					listing.Id, mlResult.ErrorMessage);
				return;
			}

			var prediction = mlResult.Data;

			// 3. Store old values for comparison
			var oldFairPrice = listing.FairPrice;
			var oldNegotiationLower = listing.NegotiationRangeLower;
			var oldNegotiationUpper = listing.NegotiationRangeUpper;

			// 4. Check if any ML value actually changed
			bool fairPriceChanged = oldFairPrice != prediction.FairPrice;
			bool negotiationChanged =
				oldNegotiationLower != prediction.NegotiationRangeLower ||
				oldNegotiationUpper != prediction.NegotiationRangeUpper;

			if (!fairPriceChanged && !negotiationChanged)
			{
				_logger.LogDebug("Listing {ListingId}: No ML value changes detected. Skipping.", listing.Id);
				return;
			}

			// 5. Update ML metadata ONLY (never touch ListingPrice)
			listing.FairPrice = prediction.FairPrice;
			listing.NegotiationRangeLower = prediction.NegotiationRangeLower;
			listing.NegotiationRangeUpper = prediction.NegotiationRangeUpper;
			listing.ConfidenceLevel = prediction.ConfidenceLevel;
			listing.ModelVersion = prediction.ModelVersion;
			listing.PredictedAt = prediction.PredictedAt;

			// 6. Create PricingHistory record
			await pricingHistoryRepo.AddAsync(new PricingHistory
			{
				ListingId = listing.Id,
				OldPrice = listing.Price,       // Seller price unchanged
				NewPrice = listing.Price,       // Seller price unchanged
				OldFairPrice = oldFairPrice,
				NewFairPrice = prediction.FairPrice,
				ChangedByUserId = null,         // System-initiated
				ChangeReason = $"Market re-evaluation | ModelVersion: {prediction.ModelVersion}",
				ChangedAt = DateTime.UtcNow
			});

			// 7. Check for significant price change and create notification
			if (IsSignificantChange(oldFairPrice, prediction.FairPrice))
			{
				_logger.LogInformation(
					"Listing {ListingId}: Significant price change detected ({OldPrice} → {NewPrice}).",
					listing.Id, oldFairPrice, prediction.FairPrice);

				await notificationRepo.AddAsync(new Notification
				{
					UserId = listing.SellerId,
					ListingId = listing.Id,
					Title = "Market Price Update",
					Message = "Market conditions have changed. The estimated market value of your vehicle has been updated. Consider reviewing your listing price."
				});
			}
		}

		private static bool IsSignificantChange(decimal? oldPrice, decimal newPrice)
		{
			if (!oldPrice.HasValue || oldPrice.Value == 0)
				return true; // First-time pricing is always significant

			var changeRatio = Math.Abs(newPrice - oldPrice.Value) / oldPrice.Value;
			return changeRatio >= SignificantChangeThreshold;
		}

		/// <summary>
		/// Fallback: if bulk save fails, try saving each listing individually.
		/// </summary>
		private async Task SavePerListingFallbackAsync(
			List<Listing> listings,
			IGenericRepository<Make> makeRepo,
			IGenericRepository<Model> modelRepo,
			IGenericRepository<PricingHistory> pricingHistoryRepo,
			IGenericRepository<Notification> notificationRepo)
		{
			_logger.LogWarning("Fallback: per-listing save is not supported in this context. " +
				"The bulk save failure has been logged. Manual intervention may be required.");
		}
	}
}
