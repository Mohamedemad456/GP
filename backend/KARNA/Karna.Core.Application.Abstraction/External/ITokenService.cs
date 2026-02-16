using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Text;

namespace Karna.Core.Application.Abstraction.External
{
	public interface ITokenService
	{
		string GenerateToken(Guid userId, string email, string userName, IEnumerable<string> roles);
		string GenerateRefreshToken();
		string HashToken(string token);
		ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
	}
}
