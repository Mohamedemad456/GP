using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class Make : BaseAuditableWithSoftDeleteEntity
	{
		public required string Name { get; set; }
		public string? LogoUrl { get; set; }
		public string? Country { get; set; }
	}
}