using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
	[Authorize(Roles = "Admin")]
	public class MakesController(IMakeService _makeService) : ApiControllerBase
	{
		[AllowAnonymous]
		[HttpGet("Active")]
		public async Task<IActionResult> GetAllActive()
		{
			var result = await _makeService.GetAllActiveAsync();
			return Ok(result);
		}

		[HttpGet("All")]
		public async Task<IActionResult> GetAll()
		{
			var result = await _makeService.GetAllAsync();
			return Ok(result);
		}

		[AllowAnonymous]
		[HttpGet("{id:guid}")]
		public async Task<IActionResult> GetById(Guid id)
		{
			var result = await _makeService.GetByIdAsync(id);
			if (!result.Success)
				return NotFound(result);
			return Ok(result);
		}

		[HttpPost("Create")]
		public async Task<IActionResult> Create([FromForm] CreateMakeDto dto)
		{
			var result = await _makeService.CreateAsync(dto);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPut("Update/{id:guid}")]
		public async Task<IActionResult> Update(Guid id, [FromForm] UpdateMakeDto dto)
		{
			var result = await _makeService.UpdateAsync(id, dto);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPatch("Activate/{id:guid}")]
		public async Task<IActionResult> Activate(Guid id)
		{
			var result = await _makeService.ActivateAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPatch("Deactivate/{id:guid}")]
		public async Task<IActionResult> Deactivate(Guid id)
		{
			var result = await _makeService.DeactivateAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpDelete("Delete/{id:guid}")]
		public async Task<IActionResult> Delete(Guid id)
		{
			var result = await _makeService.DeleteAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}
	}
}
