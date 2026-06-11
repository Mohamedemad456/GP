namespace Karna.Core.Application.Abstraction.DTOs.Admin
{
	public class UserListDto
	{
		public Guid UserId { get; set; }
		public string Name { get; set; } = string.Empty;
		public string Email { get; set; } = string.Empty;
		public string? PhoneNumber { get; set; }
		public bool IsActive { get; set; }
		public DateTime CreatedAt { get; set; }
	}
}
