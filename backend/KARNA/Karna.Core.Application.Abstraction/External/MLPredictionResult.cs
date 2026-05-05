using Karna.Core.Application.Abstraction.DTOs.Listing;

namespace Karna.Core.Application.Abstraction.External
{
    public class MLPredictionResult
    {
        public bool Success { get; set; }
        public GeneratePriceResponseDto? Data { get; set; }
        public string? ErrorMessage { get; set; }
    }
}