using System;
using System.Collections.Generic;
using System.Text;
using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs.ListingPhoto;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
    [Route("api/listings")]
    [Authorize(Roles = "User")]
    public class ListingPhotosController(IListingPhotoService _service) : ApiControllerBase
    {
        [HttpPost("{id:guid}/photos")]
        public async Task<IActionResult> Upload(Guid id, [FromForm] UploadListingPhotosDto dto)
        {
            var result = await _service.UploadAsync(id, dto);

            if (!result.Success)
                return BadRequest(result);

            return Ok(result);
        }
    }
}
