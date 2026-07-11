using Microsoft.AspNetCore.Http;

namespace Karna.Core.Application.Abstraction.DTOs.Make
{
	public class UpdateMakeDto
	{
		public string Name { get; set; } = string.Empty;
		public string NameAr { get; set; } = string.Empty;
		public IFormFile? Icon { get; set; }
		public string? Country { get; set; }
		public string? CountryAr { get; set; }
	}
}