using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.APIs.Controllers.Controllers
{
	public class UserController(IUserService _userService) : ApiControllerBase
	{
		[Authorize]
		[HttpGet("profile")]
		public async Task<IActionResult> GetProfile()
		{
			var result = await _userService.GetProfileAsync();
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}
	}
}
