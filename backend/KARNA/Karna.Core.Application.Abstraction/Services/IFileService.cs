using Microsoft.AspNetCore.Http;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IFileService
	{
		Task<string> SaveFileAsync(IFormFile file, string folder);
		void DeleteFile(string relativePath);
	}
}