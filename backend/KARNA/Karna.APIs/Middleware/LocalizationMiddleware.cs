using Microsoft.AspNetCore.Localization;
using System.Globalization;

namespace Karna.APIs.Middleware
{
	public static class LocalizationMiddleware
	{
		public static IApplicationBuilder UseLocalizationMiddleware(this IApplicationBuilder app)
		{
			var supportedCultures = new[]
			{
				new CultureInfo("en"),
				new CultureInfo("ar")
			};

			var options = new RequestLocalizationOptions
			{
				DefaultRequestCulture = new RequestCulture("en"),
				SupportedCultures = supportedCultures,
				SupportedUICultures = supportedCultures
			};

			options.FallBackToParentCultures = true;
			options.FallBackToParentUICultures = true;

			options.RequestCultureProviders =
				[
					new AcceptLanguageHeaderRequestCultureProvider(),
				];

			app.UseRequestLocalization(options);

			return app;
		}
	}
}
