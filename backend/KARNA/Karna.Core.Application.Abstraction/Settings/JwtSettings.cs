using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.Settings
{
	public class JwtSettings
	{
		public required string SecretKey { get; set; }
		public required string Audience { get; set; }
		public required string Issuer { get; set; }
		public required double ExpirationMinutes { get; set; }
		public required double RefreshTokenExpirationDays { get; set; }
	}
}
