using System;
using System.Collections.Generic;
using System.Text;
using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.Auth;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators
{
    public class ChangePasswordValidator : AbstractValidator<ChangePasswordDto>
    {
        public ChangePasswordValidator(ILocalizationService localizer) 
        {
            RuleFor(x => x.OldPassword)
            .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"));
            
           RuleFor(x => x.NewPassword)
            .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
                .MinimumLength(8).WithMessage(localizer.GetValidationMessage("PasswordTooShort", 8))
                .MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100))
                .Matches(@"[A-Z]").WithMessage(localizer.GetValidationMessage("PasswordRequiresUpper"))
                .Matches(@"[a-z]").WithMessage(localizer.GetValidationMessage("PasswordRequiresLower"))
                .Matches(@"\d").WithMessage(localizer.GetValidationMessage("PasswordRequiresDigit"))
                .Matches(@"[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]").WithMessage(localizer.GetValidationMessage("PasswordRequiresSpecial"));

           RuleFor(x => x.ConfirmPassword)
            .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiresField"))
            .Equal(x => x.NewPassword).WithMessage(localizer.GetValidationMessage("PasswordsDoNotMatch"));
        }
    }
}
