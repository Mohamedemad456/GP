using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class AdminActivityLog : BaseEntity
	{
		public Guid AdminId { get; set; }
		public User Admin { get; set; } = null!;

		public string Action { get; set; } = null!;
		public string EntityType { get; set; } = null!;
		public Guid EntityId { get; set; }

		public string? Details { get; set; }
		public DateTime PerformedAt { get; set; } = DateTime.UtcNow;
	}
}
