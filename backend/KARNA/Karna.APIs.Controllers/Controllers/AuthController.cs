using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs.Auth;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace Karna.APIs.Controllers.Controllers
{
	public class AuthController(IAuthService _authService) : ApiControllerBase
	{
		[HttpPost("login")]
		public async Task<IActionResult> Login([FromBody] LoginDto loginDto)
		{
			var deviceInfo = Request.Headers.UserAgent.ToString();
			var result = await _authService.LoginAsync(loginDto, deviceInfo);

			if (!result.Success)
				return Unauthorized(result);

			return Ok(result);
		}
		[AllowAnonymous]
		[HttpPost("register")]
		public async Task<IActionResult> Register([FromBody] RegisterDto registerDto)
		{
			var deviceInfo = Request.Headers.UserAgent.ToString();
			var result = await _authService.RegisterAsync(registerDto, deviceInfo);

			if (!result.Success)
				return BadRequest(result);

			return Ok(result);
		}



		/// <summary>
		/// Cookie-based silent refresh.
		/// Reads AccessToken + RefreshToken directly from HttpOnly cookies so the
		/// browser can call this without JS ever touching the raw token values.
		/// </summary>
		[AllowAnonymous]
		[HttpPost("refresh-cookie")]
		public async Task<IActionResult> RefreshFromCookie()
		{
			var accessToken = Request.Cookies["AccessToken"];
			var refreshToken = Request.Cookies["RefreshToken"];

			if (string.IsNullOrEmpty(accessToken) || string.IsNullOrEmpty(refreshToken))
				return Unauthorized();

			var dto = new RefreshTokenRequestDto
			{
				AccessToken = accessToken,
				RefreshToken = refreshToken
			};

			var result = await _authService.RefreshTokenAsync(dto);

			if (!result.Success)
				return Unauthorized(result);

			return Ok(result);
		}

		[Authorize]
		[HttpPost("logout")]
		public async Task<IActionResult> Logout()
		{
			var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
			if (userId is null)
				return Unauthorized();

			var result = await _authService.LogoutAsync(Guid.Parse(userId));
			return Ok(result);
		}

		[Authorize]
		[HttpPost("logout-all")]
		public async Task<IActionResult> LogoutFromAllDevices()
		{
			var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
			if (userId is null)
				return Unauthorized();

			var result = await _authService.LogoutFromAllDevicesAsync(Guid.Parse(userId));
			return Ok(result);
		}

        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePasswordAsync([FromBody] ChangePasswordDto dto)
        {
            var result = await _authService.ChangePasswordAsync(dto);

            if (!result.Success)
                return BadRequest(result);

            return Ok(result);
        }
    }
}
