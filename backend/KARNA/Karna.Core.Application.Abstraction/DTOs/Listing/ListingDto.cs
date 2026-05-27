using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class ListingDto
	{
		public Guid Id { get; set; }
		public Guid SellerId { get; set; }
		public Guid MakeId { get; set; }
		public Guid ModelId { get; set; }
		public int Year { get; set; }
		public int Mileage { get; set; }
		public FuelType FuelType { get; set; }
		public TransmissionType Transmission { get; set; }
		public decimal EngineSize { get; set; }
		public string Color { get; set; } = string.Empty;
		public string Description { get; set; } = string.Empty;
		public EgyptLocation Location { get; set; }

		// Seller Contact Information
		public string ContactPhoneNumber { get; set; } = string.Empty;
		public string? WhatsAppNumber { get; set; }
		public ContactMethod PreferredContactMethod { get; set; }

		public decimal? Price { get; set; }
		public ListingStatus Status { get; set; }
		public DateTime CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
		public DateTime? SoldAt { get; set; }

		// Admin Moderation Fields
		public DateTime? ApprovedAt { get; set; }
		public string? RejectionReason { get; set; }

		// ML Pricing Fields
		public decimal? FairPrice { get; set; }
		public decimal? NegotiationRangeLower { get; set; }
		public decimal? NegotiationRangeUpper { get; set; }
		public string? ConfidenceLevel { get; set; }
		public string? ModelVersion { get; set; }
		public DateTime? PredictedAt { get; set; }
	}
}