namespace Karna.Core.Application.Abstraction.DTOs.User
{
	public class UserDto
	{
		public Guid UserId { get; set; }
		public string Name { get; set; } = string.Empty;
		public string UserName { get; set; } = string.Empty;
		public string Email { get; set; } = string.Empty;
		public string? WhatsAppNumber { get; set; }
		public string? PhoneNumber { get; set; }
		public bool IsActive { get; set; }
		public DateTime CreatedAt { get; set; }
		public IEnumerable<string> Roles { get; set; } = [];
	}
}
