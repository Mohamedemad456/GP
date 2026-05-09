using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
	[Authorize(Roles = "Admin")]
	[Route("api/admin")]
	public class AdminController(IAdminService _adminService) : ApiControllerBase
	{
		[HttpGet("listings/pending")]
		public async Task<IActionResult> GetPendingListings([FromQuery] PendingListingSpecParams specParams)
		{
			var result = await _adminService.GetPendingListingsAsync(specParams);
			return Ok(result);
		}

		[HttpPost("listings/{id:guid}/approve")]
		public async Task<IActionResult> ApproveListing(Guid id)
		{
			var result = await _adminService.ApproveListingAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}
	}
}
