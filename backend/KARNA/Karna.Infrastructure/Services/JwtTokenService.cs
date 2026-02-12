using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Settings;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

namespace Karna.Infrastructure.Services
{
	public class JwtTokenService : ITokenService
	{
		private readonly JwtSettings _jwtSettings;

		public JwtTokenService(IOptions<JwtSettings> jwtSettings)
		{
			_jwtSettings = jwtSettings.Value;
		}
		public string GenerateToken(Guid userId, string email,string userName, IEnumerable<string> roles)
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
	}
}
