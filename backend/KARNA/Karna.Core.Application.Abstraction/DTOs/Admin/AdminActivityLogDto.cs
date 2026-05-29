namespace Karna.Core.Application.Abstraction.DTOs.Admin
{
	public class AdminActivityLogDto
	{
		public Guid Id { get; set; }
		public Guid AdminId { get; set; }
		public string AdminName { get; set; } = string.Empty;
		public string Action { get; set; } = string.Empty;
		public string EntityType { get; set; } = string.Empty;
		public Guid EntityId { get; set; }
		public string? Details { get; set; }
		public DateTime PerformedAt { get; set; }
	}
}
