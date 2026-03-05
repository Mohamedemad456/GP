using System.Reflection;
using System.Text.Json;

namespace Karna.Infrastructure.Persistence._Data.Seeds
{
	internal static class SeedLoader
	{
		private static readonly JsonSerializerOptions _options = new()
		{
			PropertyNameCaseInsensitive = true
		};

		public static async Task<List<T>> LoadAsync<T>(string fileName)
		{
			var assembly = Assembly.GetExecutingAssembly();
			var resourceName = assembly.GetManifestResourceNames()
				.FirstOrDefault(n => n.EndsWith(fileName, StringComparison.OrdinalIgnoreCase));

			if (resourceName is null)
				return [];

			await using var stream = assembly.GetManifestResourceStream(resourceName)!;
			return await JsonSerializer.DeserializeAsync<List<T>>(stream, _options) ?? [];
		}
	}
}