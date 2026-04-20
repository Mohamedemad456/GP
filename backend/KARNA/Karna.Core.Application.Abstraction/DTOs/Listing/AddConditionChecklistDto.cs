namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class AddConditionChecklistDto
	{
		public List<Guid> ConditionDefectIds { get; set; } = new();
	}
}
