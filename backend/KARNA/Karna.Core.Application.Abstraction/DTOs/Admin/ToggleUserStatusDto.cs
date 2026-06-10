namespace Karna.Core.Application.Abstraction.DTOs.Admin
{
	public class ToggleUserStatusDto
	{
		public Guid UserId { get; set; }
		public bool IsActive { get; set; }
	}
}
