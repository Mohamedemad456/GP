namespace Karna.Core.Application.Abstraction.DTOs.Auth
{
	public class TokenResponseDto
	{
		public required string AccessToken { get; set; }
		public required string RefreshToken { get; set; }
		public DateTime Expiration { get; set; }
	}
}