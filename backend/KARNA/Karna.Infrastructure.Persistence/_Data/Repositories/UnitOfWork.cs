using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain._Common;
using System.Collections.Concurrent;

namespace Karna.Infrastructure.Persistence._Data.Repositories
{
	internal class UnitOfWork(AppDbContext dbContext) : IUnitOfWork
	{
		private readonly ConcurrentDictionary<string, object> _repositories = new();

		public IGenericRepository<T> GetRepository<T>() where T : BaseEntity
		{
			var typeName = typeof(T).FullName!;
			return (IGenericRepository<T>)_repositories
				.GetOrAdd(typeName, _ => new GenericRepository<T>(dbContext));
		}

		public async Task<int> CompleteAsync()
		{
			return await dbContext.SaveChangesAsync();
		}

		public async ValueTask DisposeAsync()
		{
			await dbContext.DisposeAsync();
			GC.SuppressFinalize(this);
		}
	}
}