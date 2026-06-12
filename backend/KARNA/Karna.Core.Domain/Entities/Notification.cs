using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class Notification : BaseAuditableEntity
	{
		public Guid UserId { get; set; }
		public User User { get; set; } = null!;

		public Guid? ListingId { get; set; }
		public Listing? Listing { get; set; }

		public string Title { get; set; } = null!;
		public string Message { get; set; } = null!;

		public bool IsRead { get; set; } = false;
		public DateTime? ReadAt { get; set; }
	}
}
