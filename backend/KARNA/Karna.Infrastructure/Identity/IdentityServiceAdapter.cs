using Karna.Core.Application.Abstraction.DTOs.Identity;
using Karna.Core.Application.Abstraction.DTOs.User;
using Karna.Core.Application.Abstraction.External;
using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Identity
{
	internal sealed class IdentityServiceAdapter(
		UserManager<ApplicationUser> _userManager,
		SignInManager<ApplicationUser> _signInManager
	) : IIdentityService
	{
		public async Task<UserIdentityDto> FindUserByUsernameAsync(string username)
		{
			var user = await _userManager.FindByNameAsync(username);

			return new UserIdentityDto
			{
				Found = user is not null,
				UserId = user?.Id ?? Guid.Empty,
				Email = user?.Email ?? string.Empty,
				PhoneNumber = user?.PhoneNumber ?? string.Empty,
				UserName = user?.UserName ?? string.Empty,
				IsActive = user?.IsActive ?? false
			};
		}
		public async Task<UserIdentityDto> FindUserByEmailAsync(string email)
		{
			var user = await _userManager.FindByEmailAsync(email);
			return new UserIdentityDto
			{
				Found = user is not null,
				UserId = user?.Id ?? Guid.Empty,
				Email = user?.Email ?? string.Empty,
				PhoneNumber = user?.PhoneNumber ?? string.Empty,
				UserName = user?.UserName ?? string.Empty,
				IsActive = user?.IsActive ?? false
			};
		}
		public async Task<UserIdentityDto> FindUserByIdAsync(Guid userId)
		{
			var user = await _userManager.FindByIdAsync(userId.ToString());

			return new UserIdentityDto
			{
				Found = user is not null,
				UserId = user?.Id ?? Guid.Empty,
				Email = user?.Email ?? string.Empty,
				UserName = user?.UserName ?? string.Empty,
				PhoneNumber = user?.PhoneNumber ?? string.Empty,
				IsActive = user?.IsActive ?? false
			};
		}


		public async Task<bool> CheckPasswordAsync(Guid userId, string password)
		{
			var user = await _userManager.FindByIdAsync(userId.ToString());
			if (user is null) return false;

			var result = await _signInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);

			return result.Succeeded;
		}

		public async Task<bool> IsLockedOutAsync(Guid userId)
		{
			var user = await _userManager.FindByIdAsync(userId.ToString());
			if (user is null) return false;

			return await _userManager.IsLockedOutAsync(user);
		}

		public async Task<IEnumerable<string>> GetUserRolesAsync(Guid userId)
		{
			var user = await _userManager.FindByIdAsync(userId.ToString());
			if (user is null) return [];

			return await _userManager.GetRolesAsync(user);
		}

		public async Task RecordAccessFailedAsync(Guid userId)
		{
			var user = await _userManager.FindByIdAsync(userId.ToString());
			if (user is not null)
			{
				await _userManager.AccessFailedAsync(user);
			}
		}

		public async Task ResetAccessFailedCountAsync(Guid userId)
		{
			var user = await _userManager.FindByIdAsync(userId.ToString());
			if (user is not null)
			{
				await _userManager.ResetAccessFailedCountAsync(user);
			}
		}

        public async Task<(bool Succeeded, UserIdentityDto? User, IEnumerable<string> Errors)>
        CreateUserAsync(string email, string password, string phoneNumber)
			{
				var user = new ApplicationUser
				{
					Id = Guid.NewGuid(),
					UserName = email,
					Email = email,
					PhoneNumber = phoneNumber,
					IsActive = true,
					EmailConfirmed = true
				};

				var result = await _userManager.CreateAsync(user, password);

				if (!result.Succeeded)
				{
					return (
						false,
						null,
						result.Errors.Select(e => e.Description)
					);
				}

				return (
					true,
					new UserIdentityDto
					{
						UserId = user.Id,
						Email = user.Email!,
						UserName = user.UserName!,
						PhoneNumber = user.PhoneNumber,
						IsActive = user.IsActive,
						Found = true
					},
					Enumerable.Empty<string>()
				);
			}

        public async Task AddToRoleAsync(Guid userId, string role)
        {
            var user = await _userManager.FindByIdAsync(userId.ToString());
            if (user is null) return;

            if (!await _userManager.IsInRoleAsync(user, role))
                await _userManager.AddToRoleAsync(user, role);
        }

        public async Task<(bool Succeeded, IEnumerable<string> Errors)> UpdateUserAsync(Guid userId, string userName, string phoneNumber)
        {
            var user = await _userManager.FindByIdAsync(userId.ToString());
            if (user is null)
                return (false, ["User not found."]);

            user.UserName = userName;
            user.PhoneNumber = phoneNumber;

            var result = await _userManager.UpdateAsync(user);

            return result.Succeeded
                ? (true, Enumerable.Empty<string>())
                : (false, result.Errors.Select(e => e.Description));
        }

        public async Task DeleteUserAsync(Guid userId)
        {
            var user = await _userManager.FindByIdAsync(userId.ToString());
            if (user is null) return;

            await _userManager.DeleteAsync(user);
        }
    }
}