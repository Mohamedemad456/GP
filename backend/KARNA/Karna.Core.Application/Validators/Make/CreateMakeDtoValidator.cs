using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators.Make
{
	public class CreateMakeDtoValidator : AbstractValidator<CreateMakeDto>
	{
		public CreateMakeDtoValidator(ILocalizationService localizer)
		{
			RuleFor(x => x.Name)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

			RuleFor(x => x.NameAr)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

			RuleFor(x => x.Country)
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100))
				.When(x => x.Country is not null);

			RuleFor(x => x.CountryAr)
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100))
				.When(x => x.CountryAr is not null);
		}
	}
}