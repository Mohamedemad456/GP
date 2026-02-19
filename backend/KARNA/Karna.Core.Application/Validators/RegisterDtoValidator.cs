using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.Auth;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators
{
    public class RegisterDtoValidator : AbstractValidator<RegisterDto>
    {
        public RegisterDtoValidator(ILocalizationService localizer)
        {
            RuleFor(x => x.Name)
                .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
                .MinimumLength(3).WithMessage(localizer.GetValidationMessage("MinLengthExceeded", 3))
                .MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

            RuleFor(x => x.Email)
                .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
                .EmailAddress().WithMessage(localizer.GetValidationMessage("InvalidEmail"))
                .MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

            RuleFor(x => x.WhatsAppNumber)
                .Matches(@"^\+?\d{7,15}$")
                .When(x => !string.IsNullOrEmpty(x.WhatsAppNumber))
                .WithMessage(localizer.GetValidationMessage("InvalidPhoneNumber"));

            RuleFor(x => x.Password)
                .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField")) 
                .MinimumLength(8).WithMessage(localizer.GetValidationMessage("PasswordTooShort", 8))
                .MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100))
                .Matches(@"[A-Z]").WithMessage(localizer.GetValidationMessage("PasswordRequiresUpper"))
                .Matches(@"[a-z]").WithMessage(localizer.GetValidationMessage("PasswordRequiresLower"))
                .Matches(@"\d").WithMessage(localizer.GetValidationMessage("PasswordRequiresDigit"))
                .Matches(@"[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]").WithMessage(localizer.GetValidationMessage("PasswordRequiresSpecial"));

            RuleFor(x => x.ConfirmPassword)
                .NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
                .Equal(x => x.Password).WithMessage(localizer.GetValidationMessage("PasswordsDoNotMatch"));
        }
    }
    
 }

