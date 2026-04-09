namespace Karna.Infrastructure.Persistence._Data.Seeds.SeedDtos
{
	public class ConditionDefectSeedDto
	{
		public string ItemName { get; set; } = default!;
		public string ItemNameAr { get; set; } = default!;
		public string? Description { get; set; }
		public string? DescriptionAr { get; set; }
		public string CategoryName { get; set; } = default!;
	}
}
