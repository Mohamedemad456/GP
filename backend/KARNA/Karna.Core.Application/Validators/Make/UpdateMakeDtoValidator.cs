using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators.Make
{
	public class UpdateMakeDtoValidator : AbstractValidator<UpdateMakeDto>
	{
		public UpdateMakeDtoValidator(ILocalizationService localizer)
		{
			RuleFor(x => x.Name)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

			RuleFor(x => x.Country)
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100))
				.When(x => x.Country is not null);
		}
	}
}