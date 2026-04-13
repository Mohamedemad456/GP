using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Services
{
	internal class ListingService(
		IUnitOfWork _unitOfWork,
		ICurrentUserService _currentUserService,
		ILocalizationService _localizer,
		IValidator<CreateListingDto> _createValidator
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
	}
}