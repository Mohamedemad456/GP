using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Services
{
	internal class ListingService(
		IUnitOfWork _unitOfWork,
		ICurrentUserService _currentUserService,
		ILocalizationService _localizer,
		IValidator<CreateListingDto> _createValidator,
		IValidator<AddConditionChecklistDto> _checklistValidator,
		IMLApiClient _mlApiClient
	) : IListingService
	{
		public async Task<ApiResponse<ListingDto>> CreateAsync(CreateListingDto dto)
		{
			var validationResult = await _createValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
			{
				return new ApiResponse<ListingDto>
				{
					Success = false,
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
				};
			}

			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
			{
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };
			}

			var userRepo = _unitOfWork.GetRepository<User>();
			var makeRepo = _unitOfWork.GetRepository<Make>();
			var modelRepo = _unitOfWork.GetRepository<Model>();
			var listingRepo = _unitOfWork.GetRepository<Listing>();

			var currentUser = await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
			if (currentUser is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("UserNotFound") };

			var make = await makeRepo.GetAsync(dto.MakeId);
			if (make is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("MakeNotFound") };

			var model = await modelRepo.GetAsync(dto.ModelId);
			if (model is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ModelNotFound") };

			if (model.MakeId != dto.MakeId)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetValidationMessage("ModelDoesNotBelongToMake") };

			var listing = dto.ToEntity(currentUser.Id);
			await listingRepo.AddAsync(listing);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ListingDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ListingCreated"),
				Data = listing.ToDto()
			};
		}

		public async Task<ApiResponse<IEnumerable<ListingDefectDto>>> AddChecklistAsync(Guid listingId, AddConditionChecklistDto dto)
		{
			// 1. Validate DTO
			var validationResult = await _checklistValidator.ValidateAsync(dto);
			if (!validationResult.IsValid)
			{
				return new ApiResponse<IEnumerable<ListingDefectDto>>
				{
					Success = false,
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
				};
			}

			// 2. Authenticate current user
			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
			{
				return new ApiResponse<IEnumerable<ListingDefectDto>>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("Unauthorized")
				};
			}

			var userRepo = _unitOfWork.GetRepository<User>();
			var currentUser = await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
			if (currentUser is null)
			{
				return new ApiResponse<IEnumerable<ListingDefectDto>>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("UserNotFound")
				};
			}

			// 3. Get listing
			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
			{
				return new ApiResponse<IEnumerable<ListingDefectDto>>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ListingNotFound")
				};
			}

			// 4. Validate ownership
			if (listing.SellerId != currentUser.Id)
			{
				return new ApiResponse<IEnumerable<ListingDefectDto>>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ListingNotOwnedByUser")
				};
			}

			// 5. Validate listing is in Draft state
			if (listing.Status != ListingStatus.Draft)
			{
				return new ApiResponse<IEnumerable<ListingDefectDto>>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ListingNotInDraftState")
				};
			}

			// 6. Load and validate selected condition defects
			var defectRepo = _unitOfWork.GetRepository<ConditionDefect>();
			var selectedDefects = (await defectRepo.FindAsync(
				d => dto.ConditionDefectIds.Contains(d.Id), withTracking: false)).ToList();

			if (selectedDefects.Count != dto.ConditionDefectIds.Count)
			{
				return new ApiResponse<IEnumerable<ListingDefectDto>>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionDefectItemsNotFound")
				};
			}

			var inactiveItems = selectedDefects.Where(d => !d.IsActive).ToList();
			if (inactiveItems.Any())
			{
				return new ApiResponse<IEnumerable<ListingDefectDto>>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("ConditionDefectInactive")
				};
			}

			// 7. Remove old checklist items (supports update)
			var listingDefectRepo = _unitOfWork.GetRepository<ListingDefect>();
			var existingDefects = (await listingDefectRepo.FindAsync(
				ld => ld.ListingId == listingId, withTracking: true)).ToList();

			if (existingDefects.Any())
			{
				listingDefectRepo.DeleteRange(existingDefects);
			}

			// 8. Create new ListingDefect records
			var now = DateTime.UtcNow;
			var newDefects = dto.ConditionDefectIds.Select(defectId => new ListingDefect
			{
				ListingId = listingId,
				ConditionDefectId = defectId,
				AppliedAt = now
			}).ToList();

			await listingDefectRepo.AddRangeAsync(newDefects);
			await _unitOfWork.CompleteAsync();

			// 9. Reload with includes for mapping
			var savedDefects = (await listingDefectRepo.FindAsync(
				ld => ld.ListingId == listingId, withTracking: false)).ToList();

			// Load related data for the DTOs
			var defectIds = savedDefects.Select(ld => ld.ConditionDefectId).ToList();
			var defectsWithCategories = (await defectRepo.FindAsync(
				d => defectIds.Contains(d.Id), withTracking: false)).ToList();

			// We need categories too — load them
			var categoryRepo = _unitOfWork.GetRepository<ConditionChecklistCategory>();
			var categoryIds = defectsWithCategories.Select(d => d.CategoryId).Distinct().ToList();
			var categories = (await categoryRepo.FindAsync(
				c => categoryIds.Contains(c.Id), withTracking: false)).ToList();

			// Attach navigation properties for mapping
			foreach (var defect in defectsWithCategories)
			{
				defect.Category = categories.FirstOrDefault(c => c.Id == defect.CategoryId)!;
			}

			foreach (var ld in savedDefects)
			{
				ld.ConditionDefect = defectsWithCategories.FirstOrDefault(d => d.Id == ld.ConditionDefectId)!;
			}

			return new ApiResponse<IEnumerable<ListingDefectDto>>
			{
				Success = true,
				Message = _localizer.GetMessage("ChecklistUpdated"),
				Data = savedDefects.ToDto()
			};
		}

		public async Task<ApiResponse<ListingDto>> SubmitAsync(Guid listingId)
		{
			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			var userRepo = _unitOfWork.GetRepository<User>();
			var currentUser = await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
			if (currentUser is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("UserNotFound") };

			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotFound") };

			if (listing.SellerId != currentUser.Id)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotOwnedByUser") };

			if (listing.Status != ListingStatus.Draft)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotInDraftState") };

			// Validate core data completeness
			if (!IsListingDataComplete(listing))
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingIncompleteData") };

			// Validate at least 3 photos uploaded
			var photoRepo = _unitOfWork.GetRepository<ListingPhoto>();
			var photos = await photoRepo.FindAsync(p => p.ListingId == listingId, withTracking: false);
			if (photos.Count() < 3)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingInsufficientPhotos") };

			// Validate condition checklist is added
			var listingDefectRepo = _unitOfWork.GetRepository<ListingDefect>();
			var defects = await listingDefectRepo.FindAsync(ld => ld.ListingId == listingId, withTracking: false);
			if (!defects.Any())
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingMissingChecklist") };

			// Validate ML pricing has been generated
			if (!HasRequiredPricing(listing))
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingMissingPricing") };

			var oldStatus = listing.Status;
			listing.Status = ListingStatus.Pending;

			await RecordStatusChangeAsync(listing.Id, oldStatus, listing.Status, currentUser.Id, null);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ListingDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ListingSubmitted"),
				Data = listing.ToDto()
			};
		}

		public async Task<ApiResponse<ListingDto>> ApproveAsync(Guid listingId)
		{
			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			if (!_currentUserService.IsInRole("Admin"))
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			var userRepo = _unitOfWork.GetRepository<User>();
			var currentUser = await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
			if (currentUser is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("UserNotFound") };

			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotFound") };

			if (listing.Status != ListingStatus.Pending)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotInPendingState") };

			var oldStatus = listing.Status;
			listing.Status = ListingStatus.Active;

			await RecordStatusChangeAsync(listing.Id, oldStatus, listing.Status, currentUser.Id, null);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ListingDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ListingApproved"),
				Data = listing.ToDto()
			};
		}

		public async Task<ApiResponse<ListingDto>> RejectAsync(Guid listingId, RejectListingDto dto)
		{
			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			if (!_currentUserService.IsInRole("Admin"))
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			var userRepo = _unitOfWork.GetRepository<User>();
			var currentUser = await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
			if (currentUser is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("UserNotFound") };

			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotFound") };

			if (listing.Status != ListingStatus.Pending)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotInPendingState") };

			var oldStatus = listing.Status;
			listing.Status = ListingStatus.Rejected;

			await RecordStatusChangeAsync(listing.Id, oldStatus, listing.Status, currentUser.Id, dto.Reason);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ListingDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ListingRejected"),
				Data = listing.ToDto()
			};
		}

		public async Task<ApiResponse<ListingDto>> MarkAsSoldAsync(Guid listingId)
		{
			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			var userRepo = _unitOfWork.GetRepository<User>();
			var currentUser = await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
			if (currentUser is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("UserNotFound") };

			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotFound") };

			if (listing.SellerId != currentUser.Id)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotOwnedByUser") };

			if (listing.Status != ListingStatus.Active)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotInActiveState") };

			var oldStatus = listing.Status;
			listing.Status = ListingStatus.Sold;

			await RecordStatusChangeAsync(listing.Id, oldStatus, listing.Status, currentUser.Id, null);
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ListingDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ListingMarkedAsSold"),
				Data = listing.ToDto()
			};
		}

		public async Task<ApiResponse<IEnumerable<ListingStatusHistoryDto>>> GetStatusHistoryAsync(Guid listingId)
		{
			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
				return new ApiResponse<IEnumerable<ListingStatusHistoryDto>> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			var userRepo = _unitOfWork.GetRepository<User>();
			var currentUser = await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
			if (currentUser is null)
				return new ApiResponse<IEnumerable<ListingStatusHistoryDto>> { Success = false, Message = _localizer.GetErrorMessage("UserNotFound") };

			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
				return new ApiResponse<IEnumerable<ListingStatusHistoryDto>> { Success = false, Message = _localizer.GetErrorMessage("ListingNotFound") };

			// Only listing owner or admin can view status history
			if (listing.SellerId != currentUser.Id && !_currentUserService.IsInRole("Admin"))
				return new ApiResponse<IEnumerable<ListingStatusHistoryDto>> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			var historyRepo = _unitOfWork.GetRepository<ListingStatusHistory>();
			var history = (await historyRepo.FindAsync(
				h => h.ListingId == listingId, withTracking: false))
				.OrderByDescending(h => h.ChangedAt)
				.ToList();

			return new ApiResponse<IEnumerable<ListingStatusHistoryDto>>
			{
				Success = true,
				Data = history.ToDto()
			};
		}
		public async Task<ApiResponse<GeneratePriceResponseDto>> GeneratePriceAsync(Guid listingId)
		{
			// 1. Authenticate current user
			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
				return new ApiResponse<GeneratePriceResponseDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			var userRepo = _unitOfWork.GetRepository<User>();
			var currentUser = await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
			if (currentUser is null)
				return new ApiResponse<GeneratePriceResponseDto> { Success = false, Message = _localizer.GetErrorMessage("UserNotFound") };

			// 2. Get listing
			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
				return new ApiResponse<GeneratePriceResponseDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotFound") };

			// 3. Validate ownership
			if (listing.SellerId != currentUser.Id)
				return new ApiResponse<GeneratePriceResponseDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotOwnedByUser") };

			// 4. Validate listing state (Draft or Pending)
			if (listing.Status != ListingStatus.Draft && listing.Status != ListingStatus.Pending)
				return new ApiResponse<GeneratePriceResponseDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotInValidStateForPricing") };

			// 5. Validate required data completeness before calling ML service.
			if (!HasRequiredPricingData(listing))
				return new ApiResponse<GeneratePriceResponseDto> { Success = false, Message = _localizer.GetErrorMessage("ListingDataIncompleteForPricing") };

			// 6. Load Make and Model names for ML API
			var makeRepo = _unitOfWork.GetRepository<Make>();
			var modelRepo = _unitOfWork.GetRepository<Model>();

			var make = await makeRepo.GetAsync(listing.MakeId);
			var model = await modelRepo.GetAsync(listing.ModelId);

			if (make is null || model is null)
				return new ApiResponse<GeneratePriceResponseDto> { Success = false, Message = _localizer.GetErrorMessage("MakeOrModelNotFound") };

			// 7. Call ML API
			var fuelTypeStr = listing.FuelType.ToString().ToLowerInvariant();
			var transmissionStr = listing.Transmission.ToString();
			var locationStr = listing.Location.ToDisplayString();

			var mlResult = await _mlApiClient.GetPricePredictionAsync(
				brand: make.Name,
				model: model.Name,
				year: listing.Year,
				mileageKm: listing.Mileage,
				fuel: fuelTypeStr,
				transmission: transmissionStr,
				location: locationStr
			);

			if (!mlResult.Success || mlResult.Data is null)
			{
				var errorMessage = string.IsNullOrWhiteSpace(mlResult.ErrorMessage)
					? _localizer.GetErrorMessage("MLServiceUnavailable")
					: mlResult.ErrorMessage;

				return new ApiResponse<GeneratePriceResponseDto> { Success = false, Message = errorMessage };
			}

			var prediction = mlResult.Data;

			// 8. Map response to listing entity fields
			listing.FairPrice = prediction.FairPrice;
			listing.NegotiationRangeLower = prediction.NegotiationRangeLower;
			listing.NegotiationRangeUpper = prediction.NegotiationRangeUpper;
			listing.ConfidenceLevel = prediction.ConfidenceLevel;
			listing.ModelVersion = prediction.ModelVersion;
			listing.PredictedAt = prediction.PredictedAt;

			// 9. Save changes
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<GeneratePriceResponseDto>
			{
				Success = true,
				Message = _localizer.GetMessage("PriceGenerated"),
				Data = prediction
			};
		}

		private static bool HasRequiredPricingData(Listing listing)
		{
			return listing.MakeId != Guid.Empty
				&& listing.ModelId != Guid.Empty
				&& listing.Year > 0
				&& listing.Mileage > 0
				&& listing.EngineSize > 0
				&& Enum.IsDefined(listing.FuelType)
				&& Enum.IsDefined(listing.Transmission)
				&& Enum.IsDefined(listing.Location);
		}

		private static bool IsListingDataComplete(Listing listing)
		{
			return listing.MakeId != Guid.Empty
				&& listing.ModelId != Guid.Empty
				&& listing.Year > 0
				&& listing.Mileage > 0
				&& listing.EngineSize > 0
				&& !string.IsNullOrWhiteSpace(listing.Color)
				&& !string.IsNullOrWhiteSpace(listing.Description)
				&& Enum.IsDefined(listing.FuelType)
				&& Enum.IsDefined(listing.Transmission)
				&& Enum.IsDefined(listing.Location);
		}

		private static bool HasRequiredPricing(Listing listing)
		{
			return listing.FairPrice is not null
				&& listing.NegotiationRangeLower is not null
				&& listing.NegotiationRangeUpper is not null
				&& !string.IsNullOrWhiteSpace(listing.ConfidenceLevel);
		}

		public async Task<ApiResponse<ListingDto>> SetPriceAsync(Guid listingId, SetListingPriceDto dto)
		{
			// 1. Authenticate current user
			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			var userRepo = _unitOfWork.GetRepository<User>();
			var currentUser = await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
			if (currentUser is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("UserNotFound") };

			// 2. Get listing
			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotFound") };

			// 3. Validate ownership
			if (listing.SellerId != currentUser.Id)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotOwnedByUser") };

			// 4. Validate listing state
			if (listing.Status != ListingStatus.Draft && listing.Status != ListingStatus.Pending)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotInValidStateForPricing") };

			// 5. Set price
			if (dto.AcceptFairPrice)
			{
				if (listing.FairPrice is null)
					return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("NoPriceGeneratedYet") };

				listing.Price = listing.FairPrice;
			}
			else
			{
				if (dto.Price is null || dto.Price <= 0)
					return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("InvalidListingPrice") };

				listing.Price = dto.Price;
			}

			// 6. Save
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ListingDto>
			{
				Success = true,
				Message = _localizer.GetMessage("PriceSet"),
				Data = listing.ToDto()
			};
		}

		private async Task RecordStatusChangeAsync(Guid listingId, ListingStatus oldStatus, ListingStatus newStatus, Guid? changedByUserId, string? reason)
		{
			var historyRepo = _unitOfWork.GetRepository<ListingStatusHistory>();
			var record = new ListingStatusHistory
			{
				ListingId = listingId,
				OldStatus = oldStatus,
				NewStatus = newStatus,
				ChangedByUserId = changedByUserId,
				Reason = reason,
				ChangedAt = DateTime.UtcNow
			};
			await historyRepo.AddAsync(record);
		}

        public async Task<ApiResponseDto> DeleteAsync(Guid id)
        {
            var listingRepo = _unitOfWork.GetRepository<Listing>();
            var historyRepo = _unitOfWork.GetRepository<ListingStatusHistory>();

            var listing = await listingRepo.GetAsync(id);

            if (listing is null)
            {
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("ListingNotFound")
                };
            }

            if (listing.IsDeleted)
            {
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetValidationMessage("ListingAlreadyDeleted")
                };
            }

            var currentUserId = _currentUserService.UserId;

            if (listing.SellerId != currentUserId)
            {
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("InvalidListingOwner")
                };
            }

            if (listing.Status == ListingStatus.Sold)
            {
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetValidationMessage("ListingCannotBeDeleted")
                };
            }

            var now = DateTime.UtcNow;

            listing.IsDeleted = true;
            listing.DeletedAt = now;

            var oldStatus = listing.Status;
            listing.Status = ListingStatus.Archived;

            var history = new ListingStatusHistory
            {
                ListingId = listing.Id,
                OldStatus = oldStatus,
                NewStatus = ListingStatus.Archived,
                ChangedByUserId = currentUserId,
                ChangedAt = now,
                Reason = _localizer.GetMessage("ListingDeletedReason")
            };

            await historyRepo.AddAsync(history);
            await _unitOfWork.CompleteAsync();

            return new ApiResponseDto
            {
                Success = true,
                Message = _localizer.GetMessage("ListingArchived")
            };

        }
    }
}