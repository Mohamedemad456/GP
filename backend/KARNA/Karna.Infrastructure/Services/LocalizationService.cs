using Karna.Core.Application.Abstraction.External;
using Microsoft.Extensions.Localization;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Services
{
	public class LocalizationService : ILocalizationService
	{
		private const string ResourceAssembly = "Karna.Core.Application";
		private const string MessageBasePath = "Localization.Resources.Messages";
		private const string EnumBasePath = "Localization.Resources.Enums";

		private readonly IStringLocalizer _apiMessages;
		private readonly IStringLocalizer _errorMessages;
		private readonly IStringLocalizer _validationMessages;
		private readonly IStringLocalizerFactory _factory;

		public LocalizationService(IStringLocalizerFactory factory)
		{

			_factory = factory;
			_apiMessages = _factory.Create($"{MessageBasePath}.ApiResponseMessages", ResourceAssembly);
			_errorMessages = _factory.Create($"{MessageBasePath}.ErrorMessages", ResourceAssembly);
			_validationMessages = _factory.Create($"{MessageBasePath}.ValidationMessages", ResourceAssembly);
		}

		public string GetMessage(string key)
		{
			return _apiMessages[key];
		}

		public string GetMessage(string key, params object[] args)
		{
			return _apiMessages[key, args];
		}
		public string GetErrorMessage(string key)
		{
			return _errorMessages[key];
		}

		public string GetErrorMessage(string key, params object[] args)
		{
			return _errorMessages[key, args];
		}


		public string GetValidationMessage(string key)
		{
			return _validationMessages[key];
		}

		public string GetValidationMessage(string key, params object[] args)
		{
			return _validationMessages[key, args];
		}
		public string GetEnumDisplayName<TEnum>(TEnum value) where TEnum : struct, Enum
		{
			var localizer = _factory.Create($"{EnumBasePath}.{typeof(TEnum).Name}", ResourceAssembly);
			return localizer[value.ToString()];
		}
	}
}
