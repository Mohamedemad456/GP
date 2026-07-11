using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
	public class Make : BaseAuditableEntity
	{
		public required string Name { get; set; }
		public required string NameAr { get; set; }
		public string? LogoUrl { get; set; }
		public string? Country { get; set; }
		public string? CountryAr { get; set; }

		public bool IsActive { get; set; } = true;
        public ICollection<Model> Models { get; set; } = new List<Model>();
    }
	
}