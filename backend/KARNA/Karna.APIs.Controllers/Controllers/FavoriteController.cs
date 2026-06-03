using System;
using System.Collections.Generic;
using System.Text;
using Karna.APIs.Controllers.Controllers._Base;
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
    }
}
