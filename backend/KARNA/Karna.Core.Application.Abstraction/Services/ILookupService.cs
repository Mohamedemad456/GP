using Karna.Core.Application.Abstraction.DTOs.Lookup;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface ILookupService
	{
		IEnumerable<LookupOptionDto> GetFuelTypes();
		IEnumerable<LookupOptionDto> GetTransmissionTypes();
		IEnumerable<LookupOptionDto> GetListingStatuses();
		IEnumerable<LookupGroupDto> GetAll();
	}
}
