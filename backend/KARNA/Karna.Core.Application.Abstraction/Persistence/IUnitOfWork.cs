using Karna.Core.Domain._Common;

namespace Karna.Core.Application.Abstraction.Persistence
{
	public interface IUnitOfWork : IAsyncDisposable
	{
		IGenericRepository<T> GetRepository<T>() where T : BaseEntity;
		Task<int> CompleteAsync();
	}
}