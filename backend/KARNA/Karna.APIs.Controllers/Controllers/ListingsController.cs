using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
	[Authorize(Roles = "User")]
	public class ListingsController(IListingService _listingService) : ApiControllerBase
	{
		[HttpPost]
		public async Task<IActionResult> Create([FromBody] CreateListingDto dto)
		{
			var result = await _listingService.CreateAsync(dto);
			if (!result.Success)
				return BadRequest(result);
			return CreatedAtAction(nameof(Create), new { id = result.Data?.Id}, result);
		}
	}
}