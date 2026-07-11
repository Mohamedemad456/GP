namespace Karna.Core.Application.Abstraction.DTOs.User
{
	public class UpdateProfileDto
	{
		public required string Name { get; set; }

		public required string UserName { get; set; }

		public required string PhoneNumber { get; set; }

		public string? WhatsAppNumber { get; set; }
	}
}
