using Karna.Core.Domain._Common;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Domain.Entities
{
	public class Listing : BaseAuditableWithSoftDeleteEntity
	{
		public Guid SellerId { get; set; }
		public User Seller { get; set; } = null!;

		public Guid MakeId { get; set; }
		public Make Make { get; set; } = null!;

		public Guid ModelId { get; set; }
		public Model Model { get; set; } = null!;

		public int Year { get; set; }
		public int Mileage { get; set; }
		public FuelType FuelType { get; set; }
		public TransmissionType Transmission { get; set; }
		public decimal EngineSize { get; set; }
		public string Color { get; set; } = null!;
		public string Description { get; set; } = null!;
		public ListingStatus Status { get; set; } = ListingStatus.Draft;
	}
}