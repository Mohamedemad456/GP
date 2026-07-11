using Microsoft.AspNetCore.Http;

namespace Karna.Core.Application.Abstraction.DTOs.Make
{
	public class CreateMakeDto
	{
		public string Name { get; set; } = string.Empty;
		public string NameAr { get; set; } = string.Empty;
		public IFormFile? Icon { get; set; }
		public string? Country { get; set; }
		public string? CountryAr { get; set; }
	}
}