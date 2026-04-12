using Karna.APIs.Controllers.Controllers._Base;
using Karna.Core.Application.Abstraction.Services;
using Microsoft.AspNetCore.Mvc;

namespace Karna.APIs.Controllers.Controllers
{
	public class LookupsController(ILookupService _lookupService) : ApiControllerBase
	{
		[HttpGet]
		public IActionResult GetAll()
		{
			return Ok(_lookupService.GetAll());
		}

		[HttpGet("fuel-types")]
		public IActionResult GetFuelTypes()
		{
			return Ok(_lookupService.GetFuelTypes());
		}

		[HttpGet("transmission-types")]
		public IActionResult GetTransmissionTypes()
		{
			return Ok(_lookupService.GetTransmissionTypes());
		}

		[HttpGet("listing-statuses")]
		public IActionResult GetListingStatuses()
		{
			return Ok(_lookupService.GetListingStatuses());
		}
	}
}
