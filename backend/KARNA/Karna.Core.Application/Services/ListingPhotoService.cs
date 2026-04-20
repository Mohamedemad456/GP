using System;
using System.Collections.Generic;
using System.Text;
using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.ListingPhoto;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Services
{
    internal class ListingPhotoService(
    IUnitOfWork _unitOfWork,
    ILocalizationService _localizer,
    IFileService _fileService,
    ICurrentUserService _currentUser,
    IValidator<UploadListingPhotosDto> _validator
) : IListingPhotoService
    {
        private const string PhotosFolder = "images/Listings";

        public async Task<ApiResponse<IEnumerable<ListingPhotoDto>>> UploadAsync(Guid listingId, UploadListingPhotosDto dto)
        {

            var validationResult = await _validator.ValidateAsync(dto);

            if (!validationResult.IsValid)
            {
                return new ApiResponse<IEnumerable<ListingPhotoDto>>
                {
                    Success = false,
                    Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
                };
            }

            var listingRepo = _unitOfWork.GetRepository<Listing>();
            var photoRepo = _unitOfWork.GetRepository<ListingPhoto>();

            var listing = await listingRepo.GetAsync(listingId);

            if (listing is null)
            {
                return new ApiResponse<IEnumerable<ListingPhotoDto>>
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("ListingNotFound")
                };
            }

            var currentUserId = _currentUser.UserId;

            if (listing.SellerId != currentUserId)
            {
                return new ApiResponse<IEnumerable<ListingPhotoDto>>
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("InvalidListingOwner")
                };
            }

            if (listing.Status != ListingStatus.Draft)
            {
                return new ApiResponse<IEnumerable<ListingPhotoDto>>
                {
                    Success = false,
                    Message = _localizer.GetValidationMessage("ListingNotEditable")
                };
            }

            var existingPhotos = await photoRepo.FindAsync(p =>
            p.ListingId == listingId && !p.IsDeleted);

            var totalCount = existingPhotos.Count() + dto.Files.Count;

            if (totalCount > 10)
            {
                return new ApiResponse<IEnumerable<ListingPhotoDto>>
                {
                    Success = false,
                    Message = _localizer.GetValidationMessage("ListingPhotosLimitReached")
                };
            }

            var hasPrimary = existingPhotos.Any(p => p.IsPrimary);

            var photos = new List<ListingPhoto>();
            var savedFilePaths = new List<string>();

            try
            {
                int startOrder = existingPhotos.Count();

                for (int i = 0; i < dto.Files.Count; i++)
                {
                    var file = dto.Files[i];

                    var path = await _fileService.SaveFileAsync(file, PhotosFolder);
                    savedFilePaths.Add(path);

                    var isPrimary = !hasPrimary && i == 0;

                    var photo = file.ToEntity(
                        listingId,
                        path,
                        startOrder + i + 1,
                        isPrimary
                    );

                    photos.Add(photo);
                }

                await photoRepo.AddRangeAsync(photos);
                await _unitOfWork.CompleteAsync();

                return new ApiResponse<IEnumerable<ListingPhotoDto>>
                {
                    Success = true,
                    Message = _localizer.GetMessage("PhotosUploaded"),
                    Data = photos.ToDto()
                };
            }
            catch
            {
                foreach (var path in savedFilePaths)
                    _fileService.DeleteFile(path);

                return new ApiResponse<IEnumerable<ListingPhotoDto>>
                {
                    Success = false,
                    Message = _localizer.GetErrorMessage("PhotoUploadFailed")
                };

            }
        }
    }
}
