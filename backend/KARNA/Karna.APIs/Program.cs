using Karna.APIs.Extensions;
using Karna.APIs.Middleware;
using Karna.Core.Application.DependencyInjection;
using Karna.Infrastructure.DependencyInjection;
using Karna.Infrastructure.Persistence.DependencyInjection;

namespace Karna.APIs
{
	public class Program
	{
		public static async Task Main(string[] args)
		{
			var webApplicationBuilder = WebApplication.CreateBuilder(args);

			// Add services to the container.

			webApplicationBuilder.Services.AddControllers();
			webApplicationBuilder.Services.AddEndpointsApiExplorer();
			webApplicationBuilder.Services.AddSwaggerGen();

			webApplicationBuilder.Services.AddPersistenceServices(webApplicationBuilder.Configuration);
			webApplicationBuilder.Services.AddIdentityServices(webApplicationBuilder.Configuration);
			webApplicationBuilder.Services.AddInfrastructureServices(webApplicationBuilder.Configuration);
			webApplicationBuilder.Services.AddApplicationServices(webApplicationBuilder.Configuration);


			var app = webApplicationBuilder.Build();

			await app.InitializeDbAsync();

			// Configure the HTTP request pipeline.
			if (app.Environment.IsDevelopment())
			{
				app.UseSwagger();
				app.UseSwaggerUI();
			}

			app.UseHttpsRedirection();

			app.UseLocalizationMiddleware();

			app.UseAuthentication();
			app.UseAuthorization();


			app.MapControllers();

            await app.RunAsync();
        }
    }
}
