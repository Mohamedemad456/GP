using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators.Listing
{
	public class UpdateListingDtoValidator : AbstractValidator<UpdateListingDto>
	{
		public UpdateListingDtoValidator(ILocalizationService localizer)
		{
			RuleFor(x => x.MakeId)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"));

			RuleFor(x => x.ModelId)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"));

			RuleFor(x => x.Year)
				.InclusiveBetween(1900, DateTime.UtcNow.Year)
				.WithMessage(localizer.GetValidationMessage("InvalidYear"));

			RuleFor(x => x.Mileage)
				.GreaterThan(0)
				.WithMessage(localizer.GetValidationMessage("MileageMustBePositive"));

			RuleFor(x => x.EngineSize)
				.GreaterThan(0)
				.WithMessage(localizer.GetValidationMessage("EngineSizeMustBePositive"));

			RuleFor(x => x.FuelType)
				.IsInEnum().WithMessage(localizer.GetValidationMessage("InvalidFuelType"));

			RuleFor(x => x.Transmission)
				.IsInEnum().WithMessage(localizer.GetValidationMessage("InvalidTransmission"));

			RuleFor(x => x.Color)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MaximumLength(50).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 50));

			RuleFor(x => x.Description)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.MaximumLength(2000).WithMessage(localizer.GetValidationMessage("MaxLengthExceeded", 2000));

			RuleFor(x => x.Location)
				.IsInEnum().WithMessage(localizer.GetValidationMessage("InvalidLocation"));
		}
	}
}
