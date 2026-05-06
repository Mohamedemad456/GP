using System.Text.Json.Serialization;

namespace Karna.Infrastructure.ML
{
	internal class MLPredictionRequestDto
	{
		[JsonPropertyName("brand")]
		public string Brand { get; set; } = string.Empty;

		[JsonPropertyName("model")]
		public string Model { get; set; } = string.Empty;

		[JsonPropertyName("year")]
		public int Year { get; set; }

		[JsonPropertyName("mileage_km")]
		public int MileageKm { get; set; }

		[JsonPropertyName("transmission")]
		public string Transmission { get; set; } = string.Empty;

		[JsonPropertyName("fuel")]
		public string Fuel { get; set; } = string.Empty;

		[JsonPropertyName("location")]
		public string Location { get; set; } = string.Empty;

		[JsonPropertyName("include_factors")]
		public bool IncludeFactors { get; set; } = false;
	}
}
