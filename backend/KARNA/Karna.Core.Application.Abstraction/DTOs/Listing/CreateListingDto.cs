using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class CreateListingDto
	{
		public Guid MakeId { get; set; }
		public Guid ModelId { get; set; }
		public int Year { get; set; }
		public int Mileage { get; set; }
		public FuelType FuelType { get; set; }
		public TransmissionType Transmission { get; set; }
		public decimal EngineSize { get; set; }
		public string Color { get; set; } = null!;
		public string Description { get; set; } = null!;
		public EgyptLocation Location { get; set; }

		// Seller Contact Information
		public string ContactPhoneNumber { get; set; } = null!;
		public string? WhatsAppNumber { get; set; }
		public ContactMethod PreferredContactMethod { get; set; } = ContactMethod.Phone;
	}
}