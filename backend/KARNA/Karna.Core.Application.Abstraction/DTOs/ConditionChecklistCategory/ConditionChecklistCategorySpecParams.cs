using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.DTOs.ConditionChecklistCategory
{
	public class ConditionChecklistCategorySpecParams : PaginationSpecParams
	{
		public bool? IsActive { get; set; }
	}
}