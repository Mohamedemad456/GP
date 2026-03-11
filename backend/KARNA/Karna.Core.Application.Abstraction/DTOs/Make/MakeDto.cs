namespace Karna.Core.Application.Abstraction.DTOs.Make
{
	public class MakeDto
	{
		public Guid Id { get; set; }
		public string Name { get; set; } = string.Empty;
		public string? LogoUrl { get; set; }
		public string? Country { get; set; }
		public bool IsActive { get; set; }
		public DateTime CreatedAt { get; set; }
		public DateTime? UpdatedAt { get; set; }
	}
}