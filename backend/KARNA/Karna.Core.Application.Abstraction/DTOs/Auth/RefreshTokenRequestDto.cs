namespace Karna.Core.Application.Abstraction.DTOs.Auth
{
	public class RefreshTokenRequestDto
	{
		public required string AccessToken { get; set; }
		public required string RefreshToken { get; set; }
	}
}