namespace Karna.Core.Domain._Common
{
	public interface ISoftDelete
	{
		bool IsDeleted { get; set; }
	}
}