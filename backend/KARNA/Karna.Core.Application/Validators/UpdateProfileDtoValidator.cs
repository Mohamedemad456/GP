using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.User;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators
{
	public class UpdateProfileDtoValidator : AbstractValidator<UpdateProfileDto>
	{
		public UpdateProfileDtoValidator(ILocalizationService localizer)
		{
			RuleFor(x => x.Name)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MinimumLength(3).WithMessage(localizer.GetValidationMessage("MinLengthExceeded", 3))
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

			RuleFor(x => x.UserName)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MinimumLength(3).WithMessage(localizer.GetValidationMessage("MinLengthExceeded", 3))
				.MaximumLength(50).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 50));

			RuleFor(x => x.PhoneNumber)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.Matches(@"^\+?\d{7,15}$").WithMessage(localizer.GetValidationMessage("InvalidPhoneNumber"));

			RuleFor(x => x.WhatsAppNumber)
				.Matches(@"^\+?\d{7,15}$")
				.When(x => !string.IsNullOrEmpty(x.WhatsAppNumber))
				.WithMessage(localizer.GetValidationMessage("InvalidPhoneNumber"));
		}
	}
}
