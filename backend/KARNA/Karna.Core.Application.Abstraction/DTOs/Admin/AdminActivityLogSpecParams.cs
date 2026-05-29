using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.DTOs.Admin
{
	public class AdminActivityLogSpecParams : PaginationSpecParams
	{
		public Guid? AdminId { get; set; }
		public string? Action { get; set; }
		public string? EntityType { get; set; }
		public DateTime? DateFrom { get; set; }
		public DateTime? DateTo { get; set; }
	}
}
