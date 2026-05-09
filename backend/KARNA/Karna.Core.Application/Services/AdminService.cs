using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Application.Specifications.Listings;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Services
{
	internal class AdminService(
		IUnitOfWork _unitOfWork,
		ICurrentUserService _currentUserService,
		ILocalizationService _localizer
	) : IAdminService
	{
		public async Task<ApiResponse<Pagination<PendingListingDto>>> GetPendingListingsAsync(PendingListingSpecParams specParams)
		{
			var repo = _unitOfWork.GetRepository<Listing>();

			var dataSpec = new PendingListingsSpecification(specParams, applyPaging: true);
			var countSpec = new PendingListingsSpecification(specParams, applyPaging: false);

			var listings = await repo.GetAllWithSpecAsync(dataSpec);
			var count = await repo.GetCountAsync(countSpec);

			return new ApiResponse<Pagination<PendingListingDto>>
			{
				Success = true,
				Data = new Pagination<PendingListingDto>(specParams.PageIndex, specParams.PageSize, count)
				{
					Data = listings.ToPendingDto()
				}
			};
		}

		public async Task<ApiResponse<ListingDto>> ApproveListingAsync(Guid listingId)
		{
			// 1. Resolve current admin
			var adminUser = await ResolveCurrentAdminAsync();
			if (adminUser is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			// 2. Get listing
			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotFound") };

			// 3. Validate status
			if (listing.Status != ListingStatus.Pending)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotInPendingState") };

			// 4. Update status
			var oldStatus = listing.Status;
			listing.Status = ListingStatus.Active;
			listing.ApprovedByAdminId = adminUser.Id;
			listing.ApprovedAt = DateTime.UtcNow;
			listing.RejectionReason = null;

			// 5. Record status history
			await RecordStatusChangeAsync(listing.Id, oldStatus, listing.Status, adminUser.Id, null);

			// 6. Log admin activity
			await LogAdminActivityAsync(adminUser.Id, "ApproveListing", "Listing", listing.Id, null);

			// 7. Save
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ListingDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ListingApproved"),
				Data = listing.ToDto()
			};
		}

		public async Task<ApiResponse<ListingDto>> RejectListingAsync(Guid listingId, RejectListingDto dto)
		{
			// 1. Validate reason
			if (string.IsNullOrWhiteSpace(dto.Reason))
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("RejectionReasonRequired") };

			// 2. Resolve current admin
			var adminUser = await ResolveCurrentAdminAsync();
			if (adminUser is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("Unauthorized") };

			// 3. Get listing
			var listingRepo = _unitOfWork.GetRepository<Listing>();
			var listing = await listingRepo.GetAsync(listingId);
			if (listing is null)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotFound") };

			// 4. Validate status
			if (listing.Status != ListingStatus.Pending)
				return new ApiResponse<ListingDto> { Success = false, Message = _localizer.GetErrorMessage("ListingNotInPendingState") };

			// 5. Update status
			var oldStatus = listing.Status;
			listing.Status = ListingStatus.Rejected;
			listing.RejectionReason = dto.Reason;

			// 6. Record status history (with reason)
			await RecordStatusChangeAsync(listing.Id, oldStatus, listing.Status, adminUser.Id, dto.Reason);

			// 7. Log admin activity (with reason as details)
			await LogAdminActivityAsync(adminUser.Id, "RejectListing", "Listing", listing.Id, dto.Reason);

			// 8. Save
			await _unitOfWork.CompleteAsync();

			return new ApiResponse<ListingDto>
			{
				Success = true,
				Message = _localizer.GetMessage("ListingRejected"),
				Data = listing.ToDto()
			};
		}

		#region Private Helpers

		private async Task<User?> ResolveCurrentAdminAsync()
		{
			if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
				return null;

			var userRepo = _unitOfWork.GetRepository<User>();
			return await userRepo.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);
		}

		private async Task RecordStatusChangeAsync(Guid listingId, ListingStatus oldStatus, ListingStatus newStatus, Guid changedByUserId, string? reason)
		{
			var historyRepo = _unitOfWork.GetRepository<ListingStatusHistory>();
			await historyRepo.AddAsync(new ListingStatusHistory
			{
				ListingId = listingId,
				OldStatus = oldStatus,
				NewStatus = newStatus,
				ChangedByUserId = changedByUserId,
				Reason = reason,
				ChangedAt = DateTime.UtcNow
			});
		}


		private async Task LogAdminActivityAsync(Guid adminId, string action, string entityType, Guid entityId, string? details)
		{
			var logRepo = _unitOfWork.GetRepository<AdminActivityLog>();
			await logRepo.AddAsync(new AdminActivityLog
			{
				AdminId = adminId,
				Action = action,
				EntityType = entityType,
				EntityId = entityId,
				Details = details,
				PerformedAt = DateTime.UtcNow
			});
		}

		#endregion
	}
}
