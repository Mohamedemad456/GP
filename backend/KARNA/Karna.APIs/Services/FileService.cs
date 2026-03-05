using Karna.Core.Application.Abstraction.Services;

namespace Karna.APIs.Services
{
	internal sealed class FileService(IWebHostEnvironment _env) : IFileService
	{
		public async Task<string> SaveFileAsync(IFormFile file, string folder)
		{
			var uploadsPath = Path.Combine(_env.WebRootPath, folder);
			Directory.CreateDirectory(uploadsPath);

			var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
			var filePath = Path.Combine(uploadsPath, fileName);

			await using var stream = new FileStream(filePath, FileMode.Create);
			await file.CopyToAsync(stream);

			return $"{folder}/{fileName}";
		}

		public void DeleteFile(string relativePath)
		{
			var fullPath = Path.Combine(_env.WebRootPath, relativePath);
			if (File.Exists(fullPath))
				File.Delete(fullPath);
		}
	}
}