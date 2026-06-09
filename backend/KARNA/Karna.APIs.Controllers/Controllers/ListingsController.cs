using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
	public class ListingsController(IListingService _listingService) : ApiControllerBase
	{
		[HttpGet("approved")]
		[AllowAnonymous]
		public async Task<IActionResult> GetApprovedListings([FromQuery] BuyerListingSpecParams specParams)
		{
			var result = await _listingService.GetApprovedListingsAsync(specParams);
			return Ok(result);
		}

		[HttpGet("my-listings")]
		[Authorize(Roles = "User")]
		public async Task<IActionResult> GetMyListings([FromQuery] MyListingSpecParams specParams)
		{
			var result = await _listingService.GetMyListingsAsync(specParams);
			if (!result.Success)
				return Unauthorized(result);
			return Ok(result);
		}

		[HttpGet("my-listings/{id}")]
		[Authorize(Roles = "User")]
		public async Task<IActionResult> GetMyListingDetails(Guid id)
		{
			var result = await _listingService.GetMyListingDetailsAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpGet("{id}")]
		[AllowAnonymous]
		public async Task<IActionResult> GetById(Guid id)
		{
			var result = await _listingService.GetByIdAsync(id);
			if (!result.Success)
				return NotFound(result);
			return Ok(result);
		}

		[HttpPost]
		[Authorize(Roles = "User")]
		public async Task<IActionResult> Create([FromBody] CreateListingDto dto)
		{
			var result = await _listingService.CreateAsync(dto);
			if (!result.Success)
				return BadRequest(result);
			return CreatedAtAction(nameof(Create), new { id = result.Data?.Id}, result);
		}

		[HttpPut("{id}")]
		[Authorize(Roles = "User")]
		public async Task<IActionResult> Update(Guid id, [FromBody] UpdateListingDto dto)
		{
			var result = await _listingService.UpdateAsync(id, dto);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPost("{id}/conditions")]
		[Authorize(Roles = "User")]
		public async Task<IActionResult> AddChecklist(Guid id, [FromBody] AddConditionChecklistDto dto)
		{
			var result = await _listingService.AddChecklistAsync(id, dto);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPatch("{id}/submit")]
		[Authorize(Roles = "User")]
		public async Task<IActionResult> Submit(Guid id)
		{
			var result = await _listingService.SubmitAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPatch("{id}/sold")]
		[Authorize(Roles = "User")]
		public async Task<IActionResult> MarkAsSold(Guid id)
		{
			var result = await _listingService.MarkAsSoldAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpGet("{id}/status-history")]
		[Authorize(Roles = "User,Admin")]
		public async Task<IActionResult> GetStatusHistory(Guid id)
		{
			var result = await _listingService.GetStatusHistoryAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpGet("{id}/pricing-history")]
		[Authorize(Roles = "User,Admin")]
		public async Task<IActionResult> GetPricingHistory(Guid id)
		{
			var result = await _listingService.GetPricingHistoryAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

        [HttpDelete("{id}")]
        [Authorize(Roles = "User")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var result = await _listingService.DeleteAsync(id);

            if (!result.Success)
                return BadRequest(result);

            return Ok(result);

        }
    

		[HttpPost("{id}/generate-price")]
		[Authorize(Roles = "User")]
		public async Task<IActionResult> GeneratePrice(Guid id)
		{
			var result = await _listingService.GeneratePriceAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPost("{id}/set-price")]
		[Authorize(Roles = "User")]
		public async Task<IActionResult> SetPrice(Guid id, [FromBody] SetListingPriceDto dto)
		{
			var result = await _listingService.SetPriceAsync(id, dto);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}
	}
}