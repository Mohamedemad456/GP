

using Karna.APIs.Extensions;
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

            webApplicationBuilder.Services.AddPersistenceDI(webApplicationBuilder.Configuration);

			var app = webApplicationBuilder.Build();

			await app.InitializeDbAsync();

            // Configure the HTTP request pipeline.
            if (app.Environment.IsDevelopment())
            {
                app.UseSwagger();
                app.UseSwaggerUI();
			}

            app.UseHttpsRedirection();

            app.UseAuthorization();


            app.MapControllers();

            await app.RunAsync();
        }
    }
}
