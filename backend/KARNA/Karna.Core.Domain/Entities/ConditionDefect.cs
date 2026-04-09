using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class ConditionDefect : BaseAuditableEntity
	{
		public required string ItemName { get; set; }
		public required string ItemNameAr { get; set; }
		public string? Description { get; set; }
		public string? DescriptionAr { get; set; }
		public bool IsActive { get; set; } = true;

		public Guid CategoryId { get; set; }
		public ConditionChecklistCategory Category { get; set; } = null!;
	}
}
