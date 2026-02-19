using FluentValidation;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Auth;
using Karna.Core.Application.Abstraction.DTOs.Identity;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Abstraction.Settings;
using Karna.Core.Domain.Entities;
using Microsoft.Extensions.Options;
using System.Security.Claims;
namespace Karna.Core.Application.Services
{
	internal sealed class AuthService(
		IIdentityService _identityService,
		IUnitOfWork _unitOfWork,
		ITokenService _tokenService,
		IValidator<LoginDto> _loginValidator,
        IValidator<RegisterDto> _registerValidator,
        IOptions<JwtSettings> _jwtSettings,
		ILocalizationService _localizer
	) : IAuthService
	{
		public async Task<ApiResponse<TokenResponseDto>> LoginAsync(LoginDto loginDto, string? deviceInfo = null)
		{
			var validationResult = await _loginValidator.ValidateAsync(loginDto);
			if (!validationResult.IsValid)
			{
				return new ApiResponse<TokenResponseDto>
				{
					Success = false,
					Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
				};
			}

			var user = await _identityService.FindUserByEmailAsync(loginDto.Email);
			if (user is null || !user.IsActive)
			{
				return new ApiResponse<TokenResponseDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("InvalidCredentials")
				};
			}

			if (await _identityService.IsLockedOutAsync(user.UserId))
			{
				return new ApiResponse<TokenResponseDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("AccountLocked")
				};
			}

			if (!await _identityService.CheckPasswordAsync(user.UserId, loginDto.Password))
			{
				await _identityService.RecordAccessFailedAsync(user.UserId);
				return new ApiResponse<TokenResponseDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("InvalidCredentials")
				};
			}

			await _identityService.ResetAccessFailedCountAsync(user.UserId);
			return await GenerateAndSaveTokensAsync(user, deviceInfo);
		}

		public async Task<ApiResponse<TokenResponseDto>> RefreshTokenAsync(RefreshTokenRequestDto dto)
		{
			var principal = _tokenService.GetPrincipalFromExpiredToken(dto.AccessToken);
			var userId = principal?.FindFirstValue(ClaimTypes.NameIdentifier);

			if (principal is null || userId is null)
			{
				return new ApiResponse<TokenResponseDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("InvalidCredentials")
				};
			}

			var incomingHash = _tokenService.HashToken(dto.RefreshToken);
			var parsedUserId = Guid.Parse(userId);
			var repo = _unitOfWork.GetRepository<RefreshToken>();

			var storedToken = await repo.GetAsync(rt =>
				rt.IdentityUserId == parsedUserId &&
				rt.TokenHashed == incomingHash &&
				!rt.IsRevoked);

			if (storedToken is null || storedToken.ExpiresAt <= DateTime.UtcNow)
			{
				return new ApiResponse<TokenResponseDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("InvalidCredentials")
				};
			}

			storedToken.IsRevoked = true;
			repo.Update(storedToken);

			var user = await _identityService.FindUserByIdAsync(parsedUserId);
			if (user is null || !user.IsActive)
			{
				return new ApiResponse<TokenResponseDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("InvalidCredentials")
				};
			}

			return await GenerateAndSaveTokensAsync(user, storedToken.DeviceInfo);
		}

		public async Task<ApiResponseDto> LogoutAsync(Guid userId)
		{
			var repo = _unitOfWork.GetRepository<RefreshToken>();
			var activeTokens = await repo.FindAsync(rt =>
				rt.IdentityUserId == userId && !rt.IsRevoked);

			var latest = activeTokens
				.OrderByDescending(rt => rt.CreatedAt)
				.FirstOrDefault();

			if (latest is not null)
			{
				latest.IsRevoked = true;
				repo.Update(latest);
				await _unitOfWork.CompleteAsync();
			}

			return new ApiResponseDto
			{
				Success = true,
				Message = _localizer.GetMessage("LogoutSuccess")
			};
		}

		public async Task<ApiResponseDto> LogoutFromAllDevicesAsync(Guid userId)
		{
			var repo = _unitOfWork.GetRepository<RefreshToken>();
			var activeTokens = await repo.FindAsync(rt =>
				rt.IdentityUserId == userId && !rt.IsRevoked);

			foreach (var token in activeTokens)
			{
				token.IsRevoked = true;
				repo.Update(token);
			}

			await _unitOfWork.CompleteAsync();

			return new ApiResponseDto
			{
				Success = true,
				Message = _localizer.GetMessage("LogoutSuccess")
			};
		}

		private async Task<ApiResponse<TokenResponseDto>> GenerateAndSaveTokensAsync(UserIdentityDto user, string? deviceInfo)
		{
			var roles = await _identityService.GetUserRolesAsync(user.UserId);
			var accessToken = _tokenService.GenerateToken(user.UserId, user.Email!, user.UserName!, roles);
			var rawRefreshToken = _tokenService.GenerateRefreshToken();
			var repo = _unitOfWork.GetRepository<RefreshToken>();

			await repo.AddAsync(new RefreshToken
			{
				IdentityUserId = user.UserId,
				TokenHashed = _tokenService.HashToken(rawRefreshToken),
				ExpiresAt = DateTime.UtcNow.AddDays(_jwtSettings.Value.RefreshTokenExpirationDays),
				DeviceInfo = deviceInfo
			});

			await _unitOfWork.CompleteAsync();

			return new ApiResponse<TokenResponseDto>
			{
				Success = true,
				Message = _localizer.GetMessage("LoginSuccess"),
				Data = new TokenResponseDto
				{
					AccessToken = accessToken,
					RefreshToken = rawRefreshToken,
					Expiration = DateTime.UtcNow.AddMinutes(_jwtSettings.Value.ExpirationMinutes)
				}
			};
		}
        public async Task<ApiResponse<TokenResponseDto>> RegisterAsync(RegisterDto registerDto, string? deviceInfo = null)

        {
        
            var validationResult = await _registerValidator.ValidateAsync(registerDto);
            if (!validationResult.IsValid)
            {
                return new ApiResponse<TokenResponseDto>
                {
                    Success = false,
                    Message = string.Join("; ", validationResult.Errors.Select(e => e.ErrorMessage))
                };
            }

            var existingUser = await _identityService.FindUserByEmailAsync(registerDto.Email);
            if (existingUser.Found)
            {
                return new ApiResponse<TokenResponseDto>
                {
                    Success = false,
                    Message = _localizer.GetValidationMessage("EmailAlreadyInUse")
                };
            }

            var (succeeded, createdUser, errors) =await _identityService.CreateUserAsync(registerDto.Email,
																							registerDto.Password);

            if (!succeeded || createdUser is null)
            {
                return new ApiResponse<TokenResponseDto>
                {
                    Success = false,
                    Message = string.Join("; ", errors)
                };
            }
			try
			{
				await _identityService.AddToRoleAsync(createdUser.UserId, "User");

				var domainUser = new User
				{
					IdentityUserId = createdUser.UserId,
					Name = registerDto.Name,
					WhatsAppNumber = registerDto.WhatsAppNumber
				};

				await _unitOfWork.GetRepository<User>().AddAsync(domainUser);
				await _unitOfWork.CompleteAsync();
			}
			catch (Exception)
            {
				await _identityService.DeleteUserAsync(createdUser.UserId);
				throw;
			}

            return await GenerateAndSaveTokensAsync(createdUser, deviceInfo);



        }

    }
}