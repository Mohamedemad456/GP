using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Settings;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Karna.Infrastructure.Services
{
	public class JwtTokenService : ITokenService
	{
		private readonly JwtSettings _jwtSettings;

		public JwtTokenService(IOptions<JwtSettings> jwtSettings)
		{
			_jwtSettings = jwtSettings.Value;
		}

		public string GenerateToken(Guid userId, string email, string userName, IEnumerable<string> roles)
		{
			var claims = new List<Claim>
			{
				new(ClaimTypes.NameIdentifier, userId.ToString()),
				new(ClaimTypes.Email, email),
				new(ClaimTypes.Name, userName)
			};
			foreach (var role in roles)
			{
				claims.Add(new Claim(ClaimTypes.Role, role));
			}

			var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
			var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

			var token = new JwtSecurityToken(
				issuer: _jwtSettings.Issuer,
				audience: _jwtSettings.Audience,
				claims: claims,
				expires: DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationMinutes),
				signingCredentials: creds
			);

			return new JwtSecurityTokenHandler().WriteToken(token);
		}

		public string GenerateRefreshToken()
		{
			var randomNumber = new byte[64];
			using var rng = RandomNumberGenerator.Create();
			rng.GetBytes(randomNumber);
			return Convert.ToBase64String(randomNumber);
		}

		public string HashToken(string token)
		{
			var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
			return Convert.ToBase64String(bytes);
		}

		public ClaimsPrincipal? GetPrincipalFromExpiredToken(string token)
		{
			var key = Encoding.UTF8.GetBytes(_jwtSettings.SecretKey);

			var tokenValidationParameters = new TokenValidationParameters
			{
				ValidateIssuer = true,
				ValidateAudience = true,
				ValidateIssuerSigningKey = true,
				ValidateLifetime = false,
				ValidIssuer = _jwtSettings.Issuer,
				ValidAudience = _jwtSettings.Audience,
				IssuerSigningKey = new SymmetricSecurityKey(key),
				ClockSkew = TimeSpan.Zero,
				RoleClaimType = ClaimTypes.Role
			};

			var tokenHandler = new JwtSecurityTokenHandler();
			var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out var securityToken);

			if (securityToken is not JwtSecurityToken jwtSecurityToken ||
				!jwtSecurityToken.Header.Alg.Equals(SecurityAlgorithms.HmacSha256, StringComparison.InvariantCultureIgnoreCase))
			{
				return null;
			}

			return principal;
		}
	}
}
