using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.ConditionDefect;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators.ConditionDefect
{
	public class CreateConditionDefectDtoValidator : AbstractValidator<CreateConditionDefectDto>
	{
		public CreateConditionDefectDtoValidator(ILocalizationService localizer)
		{
			RuleFor(x => x.ItemName)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MaximumLength(200).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 200));

			RuleFor(x => x.ItemNameAr)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MaximumLength(200).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 200));

			RuleFor(x => x.Description)
				.MaximumLength(500).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 500))
				.When(x => x.Description is not null);

			RuleFor(x => x.DescriptionAr)
				.MaximumLength(500).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 500))
				.When(x => x.DescriptionAr is not null);

			RuleFor(x => x.CategoryId)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"));
		}
	}
}
