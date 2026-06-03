using System;
using System.Collections.Generic;
using System.Text;
using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.ConditionDefect;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Services
{
    public class FavoriteService(
        IUnitOfWork _unitOfWork,
        ICurrentUserService _currentUserService,
        ILocalizationService _localizer
        ) : IFavoriteService
    {
        public async Task<ApiResponseDto> AddAsync(Guid listingId)
        {
            if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("Unauthorized")
                };

            var userId = _currentUserService.UserId;

            var listingRepo = _unitOfWork.GetRepository<Listing>();
            var favoriteRepo = _unitOfWork.GetRepository<Favorite>();

            var listing = await listingRepo.GetAsync(listingId);

            if (listing is null)
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("ListingNotFound")
                };

            if (listing.IsDeleted)
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetValidationMessage("ListingDeleted")
                };

            if (listing.Status != ListingStatus.Active)
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetValidationMessage("ListingNotActive")
                };

            var exists = await favoriteRepo.GetAsync(x =>
                x.UserId == userId &&
                x.ListingId == listingId);

            if (exists is not null)
            {
                return new ApiResponseDto
                {
                    Success = true,
                    Message = _localizer.GetMessage("AlreadyInFavorites")
                };
            }

            var favorite = new Favorite
            {
                UserId = userId,
                ListingId = listingId
            };

            await favoriteRepo.AddAsync(favorite);
            await _unitOfWork.CompleteAsync();

            return new ApiResponseDto
            {
                Success = true,
                Message = _localizer.GetMessage("FavoriteAdded")
            };
        }
    }
}
