using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Auth;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IAuthService
	{
		Task<ApiResponse<TokenResponseDto>> LoginAsync(LoginDto loginDto, string? deviceInfo = null);
		Task<ApiResponse<TokenResponseDto>> RefreshTokenAsync(RefreshTokenRequestDto dto);
		Task<ApiResponseDto> LogoutAsync(Guid userId);
		Task<ApiResponseDto> LogoutFromAllDevicesAsync(Guid userId);
        Task<ApiResponse<TokenResponseDto>> RegisterAsync(RegisterDto registerDto, string? deviceInfo = null);


    }
}	