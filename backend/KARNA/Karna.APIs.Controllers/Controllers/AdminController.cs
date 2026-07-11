using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs.Admin;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
	[Authorize(Roles = "Admin")]
	[Route("api/admin")]
	public class AdminController(
		IAdminService _adminService,
		IAdminActivityLogService _activityLogService
	) : ApiControllerBase
	{
		[HttpGet("users")]
		public async Task<IActionResult> GetUsers([FromQuery] UserListSpecParams specParams)
		{
			var result = await _adminService.GetUsersAsync(specParams);
			return Ok(result);
		}

		[HttpPatch("users/{id:guid}/toggle-status")]
		public async Task<IActionResult> ToggleUserStatus(Guid id)
		{
			var result = await _adminService.ToggleUserStatusAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpGet("listings/pending")]
		public async Task<IActionResult> GetPendingListings([FromQuery] PendingListingSpecParams specParams)
		{
			var result = await _adminService.GetPendingListingsAsync(specParams);
			return Ok(result);
		}

		[HttpPatch("listings/{id:guid}/approve")]
		public async Task<IActionResult> ApproveListing(Guid id)
		{
			var result = await _adminService.ApproveListingAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPatch("listings/{id:guid}/reject")]
		public async Task<IActionResult> RejectListing(Guid id, [FromBody] RejectListingDto dto)
		{
			var result = await _adminService.RejectListingAsync(id, dto);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpGet("logs")]
		public async Task<IActionResult> GetAdminLogs([FromQuery] AdminActivityLogSpecParams specParams)
		{
			var result = await _activityLogService.GetLogsAsync(specParams);
			return Ok(result);
		}

		[HttpPost("listings/re-evaluate-market")]
		public async Task<IActionResult> ReEvaluateMarket()
		{
			var result = await _adminService.TriggerMarketReEvaluationAsync();
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}
	}
}

