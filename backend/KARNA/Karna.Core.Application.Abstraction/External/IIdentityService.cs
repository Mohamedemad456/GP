using Karna.Core.Application.Abstraction.DTOs.Identity;
using Karna.Core.Application.Abstraction.DTOs.User;
using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.External
{
	public interface IIdentityService
	{
		Task<UserIdentityDto> FindUserByUsernameAsync(string username);
		Task<UserIdentityDto> FindUserByEmailAsync(string email);
		Task<UserIdentityDto> FindUserByIdAsync(Guid userId);
		Task<bool> CheckPasswordAsync(Guid userId, string password);
		Task<bool> IsLockedOutAsync(Guid userId);
		Task<IEnumerable<string>> GetUserRolesAsync(Guid userId);
		Task RecordAccessFailedAsync(Guid userId);
		Task ResetAccessFailedCountAsync(Guid userId);
        Task<(bool Succeeded, UserIdentityDto? User, IEnumerable<string> Errors)> CreateUserAsync(string email,
																									string password,
																									string phoneNumber);
        Task<(bool Succeeded, IEnumerable<string> Errors)> UpdateUserAsync(Guid userId, string userName, string phoneNumber);
        Task AddToRoleAsync(Guid userId, string role);
		Task DeleteUserAsync(Guid userId);
		Task<(bool Succeeded, IEnumerable<string> Errors)> ChangePassAsync(Guid userId, 
																			string oldPass, 
																			string newPass);
		Task<IDictionary<Guid, UserIdentityDto>> GetUsersIdentityByIdsAsync(IEnumerable<Guid> userIds);

	}
}
