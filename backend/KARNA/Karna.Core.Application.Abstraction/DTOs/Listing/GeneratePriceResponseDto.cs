namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class GeneratePriceResponseDto
	{
		public decimal FairPrice { get; set; }
		public decimal NegotiationRangeLower { get; set; }
		public decimal NegotiationRangeUpper { get; set; }
		public string ConfidenceLevel { get; set; } = string.Empty;
		public List<PriceFactorDto> PriceFactors { get; set; } = new();
		public string ModelVersion { get; set; } = string.Empty;
		public DateTime PredictedAt { get; set; }
	}
}
