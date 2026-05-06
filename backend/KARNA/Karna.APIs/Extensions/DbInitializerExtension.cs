using Karna.Core.Application.Abstraction.Initializers;

namespace Karna.APIs.Extensions
{
	public static class DbInitializerExtension
	{
		public static async Task<WebApplication> InitializeDbAsync(this WebApplication app)
		{
			using var scope = app.Services.CreateAsyncScope();
			var services = scope.ServiceProvider;
			var appIdentityDbContextInitializer = services.GetRequiredService<IAppIdentityDbInitializer>();
			var appDbContextInitializer = services.GetRequiredService<IAppDbInitializer>();

			var loggerFactory = services.GetRequiredService<ILoggerFactory>();
			var logger = loggerFactory.CreateLogger<Program>();

			const int maxRetries = 10;
			const int delaySeconds = 5;

			for (int i = 1; i <= maxRetries; i++)
			{
				try
				{
					await appIdentityDbContextInitializer.InitializeDbAsync();
					await appDbContextInitializer.InitializeDbAsync();

					await appIdentityDbContextInitializer.SeedDbAsync();
					await appDbContextInitializer.SeedDbAsync();

					logger.LogInformation("Database initialized and seeded successfully.");
					break;
				}
				catch (Exception ex)
				{
					logger.LogWarning(ex,
						"Database initialization attempt {Attempt}/{MaxRetries} failed. Retrying in {Delay}s...",
						i, maxRetries, delaySeconds);

					if (i == maxRetries)
					{
						logger.LogError(ex, "Database initialization failed after {MaxRetries} attempts.", maxRetries);
						throw;
					}

					await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
				}
			}

			return app;
		}
	}
}
