using System;
using System.Collections.Generic;
using System.Text;
using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.ConditionDefect;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Application.Specifications.Favoriet;
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

            var userRepo = _unitOfWork.GetRepository<User>();
            var currentUser = await userRepo.GetAsync(
                u => u.IdentityUserId == _currentUserService.UserId);

            if (currentUser is null)
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("UserNotFound")
                };

            var userId = currentUser.Id;


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

        public async Task<ApiResponse<Pagination<BuyerListingDto>>> GetUserFavoritesAsync(PaginationSpecParams specParams)
        {
            if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
            {
                return new ApiResponse<Pagination<BuyerListingDto>>
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("Unauthorized")
                };
            }

            var userRepo = _unitOfWork.GetRepository<User>();
            var currentUser = await userRepo.GetAsync(
                u => u.IdentityUserId == _currentUserService.UserId);

            if (currentUser is null)
            {
                return new ApiResponse<Pagination<BuyerListingDto>>
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("UserNotFound")
                };
            }

            var userId = currentUser.Id;


            var favoriteRepo = _unitOfWork.GetRepository<Favorite>();

            var dataSpec = new UserFavoritesSpecification(
                userId,
                specParams,
                applyPaging: true);

            var countSpec = new UserFavoritesSpecification(
                userId,
                specParams,
                applyPaging: false);

            var favorites = await favoriteRepo.GetAllWithSpecAsync(dataSpec);

            var count = await favoriteRepo.GetCountAsync(countSpec);

            return new ApiResponse<Pagination<BuyerListingDto>>
            {
                Success = true,
                Data = new Pagination<BuyerListingDto>(
                    specParams.PageIndex,
                    specParams.PageSize,
                    count)
                {
                    Data = favorites.ToBuyerListingDto()
                }
            };
        }

        public async Task<ApiResponseDto> RemoveAsync(Guid listingId)
        {
            if (!_currentUserService.IsAuthenticated || _currentUserService.UserId == Guid.Empty)
            {
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("Unauthorized")
                };
            }

            var userRepo = _unitOfWork.GetRepository<User>();
            var currentUser = await userRepo.GetAsync(
                u => u.IdentityUserId == _currentUserService.UserId);

            if (currentUser is null)
            {
                return new ApiResponseDto
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("UserNotFound")
                };
            }

            var userId = currentUser.Id;

            var favoriteRepo = _unitOfWork.GetRepository<Favorite>();

            var favorite = await favoriteRepo.GetAsync(x =>
                x.UserId == userId &&
                x.ListingId == listingId);

            if (favorite is null)
            {
                return new ApiResponseDto
                {
                    Success = true,
                    Message = _localizer.GetMessage("FavoriteRemoved")
                };
            }

            favoriteRepo.Delete(favorite);

            await _unitOfWork.CompleteAsync();

            return new ApiResponseDto
            {
                Success = true,
                Message = _localizer.GetMessage("FavoriteRemoved")
            };
        }
    }
}
