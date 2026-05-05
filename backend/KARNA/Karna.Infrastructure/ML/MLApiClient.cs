using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.External;
using Microsoft.Extensions.Logging;

namespace Karna.Infrastructure.ML
{
	internal class MLApiClient(HttpClient _httpClient, ILogger<MLApiClient> _logger) : IMLApiClient
	{
		public async Task<MLPredictionResult> GetPricePredictionAsync(
			string brand, string model, int year, int mileageKm,
			string fuel, string transmission, string location)
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
					Location = location,
					IncludeFactors = true
				};

				var response = await _httpClient.PostAsJsonAsync("/api/v1/predict", request);
				if (!response.IsSuccessStatusCode)
				{
					var responseBody = await response.Content.ReadAsStringAsync();
					_logger.LogWarning(
						"ML API returned {StatusCode} for {Brand} {Model} {Year}. Body: {ResponseBody}",
						(int)response.StatusCode,
						brand,
						model,
						year,
						responseBody);

					return new MLPredictionResult
					{
						Success = false,
						ErrorMessage = BuildErrorMessage(response.StatusCode, responseBody)
					};
				}

				var mlResponse = await response.Content.ReadFromJsonAsync<MLPredictionResponseDto>();
				if (mlResponse is null || mlResponse.NegotiationRange is null)
				{
					_logger.LogWarning("ML API returned null response body");
					return new MLPredictionResult
					{
						Success = false,
						ErrorMessage = "The pricing service returned an invalid response. Please try again."
					};
				}

				var predictedAtUtc = ParsePredictedAtUtc(mlResponse.PredictedAt);

				return new MLPredictionResult
				{
					Success = true,
					Data = new GeneratePriceResponseDto
					{
						FairPrice = mlResponse.FairPrice,
						NegotiationRangeLower = mlResponse.NegotiationRange.MinPrice,
						NegotiationRangeUpper = mlResponse.NegotiationRange.MaxPrice,
						ConfidenceLevel = mlResponse.Confidence,
						PriceFactors = mlResponse.PriceFactors?.Select(f => new PriceFactorDto
						{
							Factor = f.Factor,
							Direction = f.Direction,
							Description = f.Description
						}).ToList() ?? new(),
						ModelVersion = mlResponse.ModelVersion,
						PredictedAt = predictedAtUtc
					}
				};
			}
			catch (TaskCanceledException ex) when (ex.InnerException is TimeoutException)
			{
				_logger.LogError(ex, "ML API request timed out for {Brand} {Model} {Year}", brand, model, year);
				return new MLPredictionResult
				{
					Success = false,
					ErrorMessage = "The pricing service timed out. Please try again."
				};
			}
			catch (HttpRequestException ex)
			{
				_logger.LogError(ex, "ML API HTTP error for {Brand} {Model} {Year}: {StatusCode}", brand, model, year, ex.StatusCode);
				return new MLPredictionResult
				{
					Success = false,
					ErrorMessage = "Unable to reach the pricing service at the moment. Please try again."
				};
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, "Unexpected error calling ML API for {Brand} {Model} {Year}", brand, model, year);
				return new MLPredictionResult
				{
					Success = false,
					ErrorMessage = "An unexpected error occurred while generating price. Please try again."
				};
			}
		}

		private static DateTime ParsePredictedAtUtc(string? predictedAt)
		{
			if (DateTimeOffset.TryParse(predictedAt, out var parsed))
				return parsed.UtcDateTime;

			return DateTime.UtcNow;
		}

		private static string BuildErrorMessage(HttpStatusCode statusCode, string responseBody)
		{
			if (statusCode == HttpStatusCode.BadRequest || statusCode == HttpStatusCode.UnprocessableEntity)
			{
				var detail = TryExtractDetail(responseBody);
				return string.IsNullOrWhiteSpace(detail)
					? "Unable to generate a price for the provided vehicle data."
					: $"Unable to generate a price for the provided vehicle data: {detail}";
			}

			if (statusCode == HttpStatusCode.RequestTimeout || statusCode == HttpStatusCode.GatewayTimeout)
				return "The pricing service timed out. Please try again.";

			return "The pricing service is temporarily unavailable. Please try again later.";
		}

		private static string? TryExtractDetail(string responseBody)
		{
			if (string.IsNullOrWhiteSpace(responseBody))
				return null;

			try
			{
				using var json = JsonDocument.Parse(responseBody);
				if (json.RootElement.ValueKind == JsonValueKind.Object &&
					json.RootElement.TryGetProperty("detail", out var detailProperty))
				{
					return detailProperty.GetString();
				}
			}
			catch (JsonException)
			{
				// Ignore parse errors and fall back to raw response below.
			}

			return responseBody;
		}
	}
}
