using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class ListingDefect : BaseEntity
	{
		public Guid ListingId { get; set; }
		public Listing Listing { get; set; } = null!;

		public Guid ConditionDefectId { get; set; }
		public ConditionDefect ConditionDefect { get; set; } = null!;

		public DateTime AppliedAt { get; set; }
	}
}
