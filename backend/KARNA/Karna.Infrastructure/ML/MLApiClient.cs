using System.Net.Http.Json;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.External;
using Microsoft.Extensions.Logging;

namespace Karna.Infrastructure.ML
{
	internal class MLApiClient(HttpClient _httpClient, ILogger<MLApiClient> _logger) : IMLApiClient
	{
		public async Task<GeneratePriceResponseDto?> GetPricePredictionAsync(
			string brand, string model, int year, int mileageKm,
			string fuel, string transmission, decimal engineSize)
		{
			try
			{
				var request = new MLPredictionRequestDto
				{
					Brand = brand,
					Model = model,
					Year = year,
					MileageKm = mileageKm,
					Fuel = fuel,
					Transmission = transmission,
					IncludeFactors = false
				};

				var response = await _httpClient.PostAsJsonAsync("/api/v1/predict", request);
				response.EnsureSuccessStatusCode();

				var mlResponse = await response.Content.ReadFromJsonAsync<MLPredictionResponseDto>();
				if (mlResponse is null)
				{
					_logger.LogWarning("ML API returned null response body");
					return null;
				}

				return new GeneratePriceResponseDto
				{
					FairPrice = mlResponse.FairPrice,
					NegotiationRangeLower = mlResponse.NegotiationRange.MinPrice,
					NegotiationRangeUpper = mlResponse.NegotiationRange.MaxPrice,
					ConfidenceLevel = mlResponse.Confidence,
					ModelVersion = mlResponse.ModelVersion,
					PredictedAt = DateTime.UtcNow
				};
			}
			catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
			{
				_logger.LogError(ex, "ML API request timed out for {Brand} {Model} {Year}", brand, model, year);
				return null;
			}
			catch (HttpRequestException ex)
			{
				_logger.LogError(ex, "ML API HTTP error for {Brand} {Model} {Year}: {StatusCode}", brand, model, year, ex.StatusCode);
				return null;
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Unexpected error calling ML API for {Brand} {Model} {Year}", brand, model, year);
				return null;
			}
		}
	}
}
