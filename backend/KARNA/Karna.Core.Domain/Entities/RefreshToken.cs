using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class RefreshToken : BaseEntity
	{
		public Guid IdentityUserId { get; set; }
		public required string TokenHashed { get; set; }
		public DateTime ExpiresAt { get; set; }
		public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
		public string? DeviceInfo { get; set; }
		public bool IsRevoked { get; set; }
	}
}