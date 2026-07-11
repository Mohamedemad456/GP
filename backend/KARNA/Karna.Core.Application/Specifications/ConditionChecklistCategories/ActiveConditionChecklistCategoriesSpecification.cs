using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.ConditionChecklistCategories
{
	public class ActiveConditionChecklistCategoriesSpecification : BaseSpecification<ConditionChecklistCategory>
	{
		public ActiveConditionChecklistCategoriesSpecification()
			: base(c => c.IsActive)
		{
			AddOrderByDescending(c => c.CreatedAt);
		}
	}
}