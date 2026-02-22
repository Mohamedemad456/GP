namespace Karna.Core.Application.Exceptions
{
	public class IdentityOperationException(IEnumerable<string> errors) : Exception
	{
		public IEnumerable<string> Errors { get; } = errors;
	}
}
