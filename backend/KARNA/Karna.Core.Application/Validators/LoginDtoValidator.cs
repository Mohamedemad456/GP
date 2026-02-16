using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.Auth;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators
{
	public class LoginDtoValidator : AbstractValidator<LoginDto>
	{
		public LoginDtoValidator(ILocalizationService localizer)
		{
			RuleFor(x => x.Email)
		   .NotEmpty().WithMessage("Email is required")
		   .EmailAddress().WithMessage("Invalid email format")
		   .MaximumLength(100);

			RuleFor(x => x.Password)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MinimumLength(8).WithMessage(localizer.GetValidationMessage("PasswordTooShort", 8))
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));
		}
	}
}