using Karna.Core.Application.Abstraction.External;
using System.Security.Claims;

namespace Karna.APIs.Services
{
	internal sealed class CurrentUserService(IHttpContextAccessor _httpContextAccessor) : ICurrentUserService
	{
		public Guid UserId
		{
			get
			{
				var userIdClaim = _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
				 return Guid.TryParse(userIdClaim, out var userId) ? userId : Guid.Empty;

			}
		}

		public string? UserName => _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Name);

		public string? Email => _httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Email);

		public bool IsAuthenticated => _httpContextAccessor.HttpContext?.User.Identity?.IsAuthenticated ?? false;

		public IEnumerable<string> Roles => _httpContextAccessor.HttpContext?.User.FindAll(ClaimTypes.Role).Select(c => c.Value) ?? [];

		public bool IsInRole(string role)
		{
			return _httpContextAccessor.HttpContext?.User.IsInRole(role) ?? false;
		}
	}
}
