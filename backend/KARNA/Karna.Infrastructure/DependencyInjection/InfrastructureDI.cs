using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Settings;
using Karna.Infrastructure.Identity;
using Karna.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Security.Claims;
using System.Text;

namespace Karna.Infrastructure.DependencyInjection
{
	public static class InfrastructureDI
	{
		public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
		{
			services.Configure<JwtSettings>(configuration.GetSection("JwtSettings"));

			services.AddAuthentication((authOptions) =>
			{
				authOptions.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
				authOptions.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
			})
				.AddJwtBearer((options) =>
				{
					var jwtSettings = configuration.GetSection("JwtSettings").Get<JwtSettings>();
					var key = Encoding.UTF8.GetBytes(jwtSettings!.SecretKey);

					options.TokenValidationParameters = new TokenValidationParameters()
					{

						ValidateIssuer = true,
						ValidateAudience = true,
						ValidateLifetime = true,
						ValidateIssuerSigningKey = true,
						ValidIssuer = jwtSettings.Issuer,
						ValidAudience = jwtSettings.Audience,
						IssuerSigningKey = new SymmetricSecurityKey(key),
						ClockSkew = TimeSpan.Zero,
						RoleClaimType = ClaimTypes.Role

					};

					options.Events = new JwtBearerEvents
					{
						OnMessageReceived = context =>
						{
							if (context.Request.Cookies.ContainsKey("AccessToken"))
							{
								context.Token = context.Request.Cookies["AccessToken"];
							}
							return Task.CompletedTask;
						}
					};
				});

			services.AddScoped<ITokenService, JwtTokenService>();
			services.AddScoped<IIdentityService, IdentityServiceAdapter>();
			services.AddLocalization();
			services.AddScoped<ILocalizationService, LocalizationService>();

			return services;
		}
	}
}
