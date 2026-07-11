using System;
using System.Collections.Generic;
using System.Text;
using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.Model;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators.Model
{
    public class CreateModelDtoValidator : AbstractValidator<CreateModelDto>
    {
        public CreateModelDtoValidator(ILocalizationService localizer)
        {
            RuleFor(x => x.Name)
                .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
                .MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

            RuleFor(x => x.NameAr)
                .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
                .MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

            RuleFor(x => x.MakeId)
                .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"));
        }

    }
}
