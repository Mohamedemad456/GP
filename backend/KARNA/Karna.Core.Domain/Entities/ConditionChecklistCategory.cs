using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class ConditionChecklistCategory : BaseAuditableEntity
	{
		public required string Name { get; set; }
		public required string NameAr { get; set; }
		public string? Description { get; set; }
		public bool IsActive { get; set; } = true;

	}
}