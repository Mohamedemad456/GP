using Karna.Core.Application.Abstraction.DTOs.Lookup;
using Karna.Core.Application.Abstraction.External;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Services
{
	internal class LookupService(ILocalizationService _localizer) : ILookupService
	{
		public IEnumerable<LookupOptionDto> GetFuelTypes()
			=> GetEnumOptions<FuelType>();

		public IEnumerable<LookupOptionDto> GetTransmissionTypes()
			=> GetEnumOptions<TransmissionType>();

		public IEnumerable<LookupOptionDto> GetListingStatuses()
			=> GetEnumOptions<ListingStatus>();

		public IEnumerable<LookupGroupDto> GetAll()
		{
			return
			[
				new LookupGroupDto { Name = "fuelTypes", Options = GetFuelTypes() },
				new LookupGroupDto { Name = "transmissionTypes", Options = GetTransmissionTypes() },
				new LookupGroupDto { Name = "listingStatuses", Options = GetListingStatuses() }
			];
		}

		private IEnumerable<LookupOptionDto> GetEnumOptions<TEnum>() where TEnum : struct, Enum
		{
			return Enum.GetValues<TEnum>().Select(value => new LookupOptionDto
			{
				Value = Convert.ToInt32(value),
				Label = _localizer.GetEnumDisplayName(value)
			});
		}
	}
}
