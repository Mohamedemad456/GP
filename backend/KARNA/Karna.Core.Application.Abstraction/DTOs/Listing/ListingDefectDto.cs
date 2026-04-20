namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class ListingDefectDto
	{
		public Guid ConditionDefectId { get; set; }
		public string CategoryName { get; set; } = string.Empty;
		public string ItemName { get; set; } = string.Empty;
	}
}
