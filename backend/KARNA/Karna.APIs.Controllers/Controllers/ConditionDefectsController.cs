using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs.ConditionDefect;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
	[Authorize(Roles = "Admin")]
	public class ConditionDefectsController(IConditionDefectService _conditionDefectService) : ApiControllerBase
	{

		[HttpGet("All")]
		public async Task<IActionResult> GetAll()
		{
			var result = await _conditionDefectService.GetAllAsync();
			return Ok(result);
		}
		[AllowAnonymous]
		[HttpGet("active")]
		public async Task<IActionResult> GetActive()
		{
			var result = await _conditionDefectService.GetAllActiveAsync();
			return Ok(result);
		}

		[HttpGet("{id:guid}")]
		public async Task<IActionResult> GetById(Guid id)
		{
			var result = await _conditionDefectService.GetByIdAsync(id);
			if (!result.Success)
				return NotFound(result);
			return Ok(result);
		}

		

		[HttpPost("Create")]
		public async Task<IActionResult> Create([FromBody] CreateConditionDefectDto dto)
		{
			var result = await _conditionDefectService.CreateAsync(dto);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPut("Update/{id:guid}")]
		public async Task<IActionResult> Update(Guid id, [FromBody] UpdateConditionDefectDto dto)
		{
			var result = await _conditionDefectService.UpdateAsync(id, dto);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpDelete("Delete/{id:guid}")]
		public async Task<IActionResult> Delete(Guid id)
		{
			var result = await _conditionDefectService.DeleteAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPatch("activate/{id:guid}")]
		public async Task<IActionResult> Activate(Guid id)
		{
			var result = await _conditionDefectService.ActivateAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

		[HttpPatch("deactivate/{id:guid}")]
		public async Task<IActionResult> Deactivate(Guid id)
		{
			var result = await _conditionDefectService.DeactivateAsync(id);
			if (!result.Success)
				return BadRequest(result);
			return Ok(result);
		}

	}
}
