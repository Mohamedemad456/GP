using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class RefreshToken : BaseAuditableEntity
	{
		public Guid IdentityUserId { get; set; }
		public required string TokenHashed { get; set; }
		public DateTime ExpiresAt { get; set; }
		public string? DeviceInfo { get; set; }
		public bool IsRevoked { get; set; }
	}
}