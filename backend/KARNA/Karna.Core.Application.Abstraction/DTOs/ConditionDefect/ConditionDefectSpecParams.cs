using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.DTOs.ConditionDefect
{
	public class ConditionDefectSpecParams : PaginationSpecParams
	{
		public Guid? CategoryId { get; set; }
		public bool? IsActive { get; set; }
	}
}