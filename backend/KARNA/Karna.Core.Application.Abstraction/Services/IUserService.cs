using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.User;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IUserService
	{
		Task<ApiResponse<UserDto>> GetProfileAsync();
		Task<ApiResponse<UserDto>> UpdateProfileAsync(UpdateProfileDto dto);
	}
}
