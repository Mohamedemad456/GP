using System.Text.Json.Serialization;

namespace Karna.Infrastructure.ML
{
	internal class MLPredictionResponseDto
	{
		[JsonPropertyName("fair_price")]
		public decimal FairPrice { get; set; }

		[JsonPropertyName("negotiation_range")]
		public MLNegotiationRangeDto NegotiationRange { get; set; } = new();

		[JsonPropertyName("confidence")]
		public string Confidence { get; set; } = string.Empty;

		[JsonPropertyName("model_version")]
		public string ModelVersion { get; set; } = string.Empty;

		[JsonPropertyName("predicted_at")]
		public string PredictedAt { get; set; } = string.Empty;

		[JsonPropertyName("price_factors")]
		public List<MLPriceFactorDto>? PriceFactors { get; set; }
	}

	internal class MLNegotiationRangeDto
	{
		[JsonPropertyName("min_price")]
		public decimal MinPrice { get; set; }

		[JsonPropertyName("max_price")]
		public decimal MaxPrice { get; set; }
	}

	internal class MLPriceFactorDto
	{
		[JsonPropertyName("factor")]
		public string Factor { get; set; } = string.Empty;

		[JsonPropertyName("direction")]
		public string Direction { get; set; } = string.Empty;

		[JsonPropertyName("description")]
		public string Description { get; set; } = string.Empty;
	}
}
