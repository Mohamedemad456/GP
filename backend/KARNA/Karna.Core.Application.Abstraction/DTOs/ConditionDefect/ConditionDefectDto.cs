namespace Karna.Core.Application.Abstraction.DTOs.ConditionDefect
{
	public class ConditionDefectDto
	{
		public Guid Id { get; set; }
		public string ItemName { get; set; } = string.Empty;
		public string? Description { get; set; }
		public bool IsActive { get; set; }
		public Guid CategoryId { get; set; }
		public string CategoryName { get; set; } = string.Empty;
		public DateTime CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
	}
}
