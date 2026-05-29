using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.External;

namespace Karna.Core.Application.Validators.Listing
{
	public class CreateListingDtoValidator : AbstractValidator<CreateListingDto>
	{
		public CreateListingDtoValidator(ILocalizationService localizer)
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

			// Seller Contact Information
			RuleFor(x => x.ContactPhoneNumber)
				.NotEmpty().WithMessage(localizer.GetValidationMessage("RequiredField"))
				.Matches(@"^\+?\d{7,15}$").WithMessage(localizer.GetValidationMessage("InvalidPhoneNumber"));

			RuleFor(x => x.WhatsAppNumber)
				.Matches(@"^\+?\d{7,15}$")
				.When(x => !string.IsNullOrEmpty(x.WhatsAppNumber))
				.WithMessage(localizer.GetValidationMessage("InvalidPhoneNumber"));

			RuleFor(x => x.PreferredContactMethod)
				.IsInEnum().WithMessage(localizer.GetValidationMessage("InvalidContactMethod"));
		}
	}
}