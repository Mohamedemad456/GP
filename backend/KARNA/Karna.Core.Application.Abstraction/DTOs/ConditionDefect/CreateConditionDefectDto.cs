namespace Karna.Core.Application.Abstraction.DTOs.ConditionDefect
{
	public class CreateConditionDefectDto
	{
		public string ItemName { get; set; } = string.Empty;
		public string ItemNameAr { get; set; } = string.Empty;
		public string? Description { get; set; }
		public string? DescriptionAr { get; set; }
		public Guid CategoryId { get; set; }
	}
}
