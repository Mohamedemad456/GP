using Karna.Core.Application.Abstraction.DTOs.Listing;

namespace Karna.Core.Application.Abstraction.External
{
	public interface IMLApiClient
	{
		Task<GeneratePriceResponseDto?> GetPricePredictionAsync(
			string brand, string model, int year, int mileageKm,
			string fuel, string transmission, decimal engineSize);
	}
}
