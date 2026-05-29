namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class ConditionCategoryDetailDto
	{
		public string CategoryName { get; set; } = string.Empty;
		public List<ConditionDefectItemDto> Defects { get; set; } = new();
	}

	public class ConditionDefectItemDto
	{
		public string ItemName { get; set; } = string.Empty;
		public string? Description { get; set; }
	}
}
