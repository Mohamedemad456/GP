using Karna.Core.Application.Abstraction.Initializers;

namespace Karna.APIs.Extensions
{
	public static class DbInitializerExtension
	{
		public static async Task<WebApplication> InitializeDbAsync(this WebApplication app)
		{
			using var scope = app.Services.CreateAsyncScope();
			var services = scope.ServiceProvider;
			var appDbContextInitializer = services.GetRequiredService<IStoreDbInitializer>();

			var loggerFactory = services.GetRequiredService<ILoggerFactory>();

			try
			{
				await appDbContextInitializer.InitializeDbAsync();
			}
			catch (Exception ex)
			{

				var logger = loggerFactory.CreateLogger<Program>();
				logger.LogError(ex, "An error has been occured during applying the migrations");
			}
			return app;
		}
	}
}
