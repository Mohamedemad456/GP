using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.ConditionDefects
{
	public class ActiveConditionDefectsWithCategorySpec : BaseSpecification<ConditionDefect>
	{
		public ActiveConditionDefectsWithCategorySpec()
			: base(x => x.IsActive)
		{
			AddInclude(x => x.Category);
			AddOrderByDescending(x => x.CreatedAt);
		}
	}
}
