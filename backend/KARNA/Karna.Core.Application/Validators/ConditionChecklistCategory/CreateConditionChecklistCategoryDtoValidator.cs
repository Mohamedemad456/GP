using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.ConditionChecklistCategory;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators.ConditionChecklistCategory
{
	public class CreateConditionChecklistCategoryDtoValidator : AbstractValidator<CreateConditionChecklistCategoryDto>
	{
		public CreateConditionChecklistCategoryDtoValidator(ILocalizationService localizer)
		{
			RuleFor(x => x.Name)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

			RuleFor(x => x.NameAr)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MaximumLength(100).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 100));

			RuleFor(x => x.Description)
				.MaximumLength(500).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 500))
				.When(x => x.Description is not null);
		}
	}
}