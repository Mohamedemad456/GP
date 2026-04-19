using System;
using System.Collections.Generic;
using System.Text;
using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.ListingPhoto;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators.ListingPhoto
{
    public class UploadListingPhotosDtoValidator : AbstractValidator<UploadListingPhotosDto>
    {
        public UploadListingPhotosDtoValidator(ILocalizationService localizer) 
        {
            RuleFor(x => x.Files)
            .NotNull()
            .WithMessage(localizer.GetValidationMessage("PhotosRequired"))
            .Must(files => files.Count <= 10)
            .WithMessage(localizer.GetValidationMessage("MaxPhotosExceeded"));

            RuleForEach(x => x.Files)
                .ChildRules(photo =>
                {
                    photo.RuleFor(p => p.Length)
                        .GreaterThan(0)
                        .WithMessage(localizer.GetValidationMessage("PhotoEmpty"));

                    photo.RuleFor(p => p.ContentType)
                        .Must(type => type.StartsWith("image/"))
                        .WithMessage(localizer.GetValidationMessage("InvalidPhotoType"));

                    photo.RuleFor(p => p.Length)
                        .LessThanOrEqualTo(5 * 1024 * 1024)
                        .WithMessage(localizer.GetValidationMessage("PhotoSizeExceeded"));
                });
        }
    }
}
