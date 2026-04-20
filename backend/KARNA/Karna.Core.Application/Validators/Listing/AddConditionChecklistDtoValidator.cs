using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators.Listing
{
	public class AddConditionChecklistDtoValidator : AbstractValidator<AddConditionChecklistDto>
	{
		public AddConditionChecklistDtoValidator(ILocalizationService localizer)
		{
			RuleFor(x => x.ConditionDefectIds)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("ConditionDefectIdsRequired"));

			RuleFor(x => x.ConditionDefectIds)
				.Must(ids => ids == null || ids.Count == ids.Distinct().Count())
				.WithMessage(localizer.GetValidationMessage("DuplicateConditionDefectIds"));
		}
	}
}
