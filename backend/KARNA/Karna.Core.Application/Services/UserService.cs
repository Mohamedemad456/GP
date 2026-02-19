using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.User;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Services
{
	internal class UserService(
		IIdentityService _identityService,
		ICurrentUserService _currentUserService,
		ILocalizationService _localizer,
		IGenericRepository<User> _userRepository
		) : IUserService
	{

		public async Task<ApiResponse<UserDto>> GetProfileAsync()
		{
			var identityUser = await _identityService.FindUserByIdAsync(_currentUserService.UserId);

			if (!identityUser.Found)
			{
				return new ApiResponse<UserDto>
				{
					Success = false,
					Message = _localizer.GetErrorMessage("UserNotFound")
				};
			}
			var domainUser = await _userRepository.GetAsync(u => u.IdentityUserId == _currentUserService.UserId);

			if (domainUser is null)
				return new ApiResponse<UserDto> { Success = false, Message = _localizer.GetErrorMessage("UserNotFound") };

			var roles = _currentUserService.Roles;

			var userProfile = new UserDto
			{
				UserId = identityUser.UserId,
				Name = domainUser.Name,
				UserName = identityUser.UserName,
				Email = identityUser.Email,
				WhatsAppNumber = domainUser.WhatsAppNumber,
				PhoneNumber = identityUser.PhoneNumber,
				IsActive = identityUser.IsActive,
				CreatedAt = domainUser.CreatedAt,
				Roles = roles
			};
			return new ApiResponse<UserDto>
			{
				Success = true,
				Data = userProfile
			};
		}
	}
}
