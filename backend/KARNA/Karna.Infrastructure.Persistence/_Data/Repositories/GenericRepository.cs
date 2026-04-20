using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain._Common;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace Karna.Infrastructure.Persistence._Data.Repositories
{
	internal class GenericRepository<T>(AppDbContext dbContext) : IGenericRepository<T>
		where T : BaseEntity
	{
		private readonly DbSet<T> _dbSet = dbContext.Set<T>();

		public async Task<T?> GetAsync(Guid id)
		{
			return await _dbSet.FindAsync(id);
		}

		public async Task<T?> GetAsync(Expression<Func<T, bool>> predicate)
		{
			return await _dbSet.FirstOrDefaultAsync(predicate);
		}

		public async Task<T?> GetWithSpecAsync(ISpecification<T> spec)
		{
			return await ApplySpecification(spec).FirstOrDefaultAsync();
		}

		public async Task<IEnumerable<T>> GetAllAsync(bool withTracking = false)
		{
			return withTracking
				? await _dbSet.ToListAsync()
				: await _dbSet.AsNoTracking().ToListAsync();
		}

		public async Task<IEnumerable<T>> GetAllWithSpecAsync(ISpecification<T> spec)
		{
			return await ApplySpecification(spec).AsNoTracking().ToListAsync();
		}

		public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, bool withTracking = false)
		{
			var query = _dbSet.Where(predicate);
			if (!withTracking) query = query.AsNoTracking();
			return await query.ToListAsync();
		}

		public async Task<int> GetCountAsync(ISpecification<T> spec)
		{
			return await ApplySpecification(spec).CountAsync();
		}

		public async Task AddAsync(T entity)
		{
			await _dbSet.AddAsync(entity);
		}

		public async Task AddRangeAsync(IEnumerable<T> entities)
		{
			await _dbSet.AddRangeAsync(entities);
		}

		public void Update(T entity)
		{
			_dbSet.Update(entity);
		}

		public void Delete(T entity)
		{
			if (entity is ISoftDelete softDelete)
			{
				softDelete.IsDeleted = true;
				_dbSet.Update(entity);
			}
			else
			{
				_dbSet.Remove(entity);
			}
		}

		public void DeleteRange(IEnumerable<T> entities)
		{
			_dbSet.RemoveRange(entities);
		}

		private IQueryable<T> ApplySpecification(ISpecification<T> spec)
		{
			return SpecificationEvaluator<T>.GetQuery(_dbSet, spec);
		}
	}
}