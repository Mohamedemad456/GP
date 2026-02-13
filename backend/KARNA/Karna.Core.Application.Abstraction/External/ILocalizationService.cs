using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.External
{
	public interface ILocalizationService
	{
		string GetMessage(string key);
		string GetMessage(string key, params object[] args);

		string GetErrorMessage(string key);
		string GetErrorMessage(string key, params object[] args);

		string GetValidationMessage(string key);
		string GetValidationMessage(string key, params object[] args);

		string GetEnumDisplayName<TEnum>(TEnum value) where TEnum : struct, Enum;
	}
}
