using Karna.Core.Domain._Common;
using System.Linq.Expressions;

namespace Karna.Core.Application.Abstraction.Persistence
{
	public interface ISpecification<TEntity> where TEntity : BaseEntity
	{
		Expression<Func<TEntity, bool>>? Criteria { get; }
		List<Expression<Func<TEntity, object>>> Includes { get; }
		Expression<Func<TEntity, object>>? OrderBy { get; }
		Expression<Func<TEntity, object>>? OrderByDescending { get; }
		int Take { get; }
		int Skip { get; }
		bool IsPagingEnabled { get; }
	}
}