using System;
using System.Collections.Generic;
using System.Text;
using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs.Model;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
    [Authorize(Roles = "Admin")]
    public class ModelsController(IModelService _modelService) : ApiControllerBase
    {
        [AllowAnonymous]
        [HttpGet("AllModels")]
        public async Task<IActionResult> GetAll()
        {
            var result = await _modelService.GetAllAsync();
            return Ok(result);
        }

        [AllowAnonymous]
        [HttpGet("{id:guid}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var result = await _modelService.GetByIdAsync(id);
            if (!result.Success)
                return NotFound(result);
            return Ok(result);
        }

        [HttpPost("Create")]
        public async Task<IActionResult> Create([FromForm] CreateModelDto dto)
        {
            var result = await _modelService.CreateAsync(dto);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpPut("Update/{id:guid}")]
        public async Task<IActionResult> Update(Guid id, [FromForm] UpdateModelDto dto)
        {
            var result = await _modelService.UpdateAsync(id, dto);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }

        [HttpDelete("Delete/{id:guid}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var result = await _modelService.DeleteAsync(id);
            if (!result.Success)
                return BadRequest(result);
            return Ok(result);
        }
    }
}
