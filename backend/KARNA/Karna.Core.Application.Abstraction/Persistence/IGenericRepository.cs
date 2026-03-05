using Karna.Core.Domain._Common;
using System.Linq.Expressions;

namespace Karna.Core.Application.Abstraction.Persistence
{
	public interface IGenericRepository<T> where T : BaseEntity
	{
		Task<T?> GetAsync(Guid id);
		Task<T?> GetAsync(Expression<Func<T, bool>> predicate);
		Task<T?> GetWithSpecAsync(ISpecification<T> spec);
		Task<IEnumerable<T>> GetAllAsync(bool withTracking = false);
		Task<IEnumerable<T>> GetAllWithSpecAsync(ISpecification<T> spec);
		Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, bool withTracking = false);
		Task<int> GetCountAsync(ISpecification<T> spec);
		Task AddAsync(T entity);
		void Update(T entity);
		void Delete(T entity);
	}
}