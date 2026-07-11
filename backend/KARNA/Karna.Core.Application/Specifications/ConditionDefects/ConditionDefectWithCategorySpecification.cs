using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.ConditionDefects
{
	public class ConditionDefectWithCategorySpecification : BaseSpecification<ConditionDefect>
	{
		public ConditionDefectWithCategorySpecification()
		{
			AddInclude(x => x.Category);
		}

		public ConditionDefectWithCategorySpecification(Guid id)
			: base(x => x.Id == id)
		{
			AddInclude(x => x.Category);
		}
	}
}
