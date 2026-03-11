using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.Makes
{
	public class ActiveMakesSpec : BaseSpecification<Make>
	{
		public ActiveMakesSpec() : base(m => m.IsActive)
		{
			AddOrderByDescending(m => m.CreatedAt);
		}
	}
}