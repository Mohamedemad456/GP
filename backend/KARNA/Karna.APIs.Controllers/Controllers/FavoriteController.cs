using System;
using System.Collections.Generic;
using System.Text;
using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
    [Route("api/Favorite")]
    [Authorize(Roles = "User")]
    internal class FavoriteController(IFavoriteService _service) : ApiControllerBase
    {
        [HttpPost("{listingId:guid}")]
        public async Task<IActionResult> AddFavorite(Guid listingId)
        {
            var result = await _service.AddAsync(listingId);

            if (!result.Success)
                return BadRequest(result);

            return Ok(result);
        }

        [HttpDelete("{listingId:guid}")]
        public async Task<IActionResult> RemoveFavorite(Guid listingId)
        {
            var result = await _service.RemoveAsync(listingId);

            if (!result.Success)
                return Unauthorized(result);

            return Ok(result);
        }

        [HttpGet]
        public async Task<IActionResult> GetFavorites([FromQuery] PaginationSpecParams specParams)
        {
            var result = await _service.GetUserFavoritesAsync(specParams);

            if (!result.Success)
                return Unauthorized(result);

            return Ok(result);
        }
    }
}
