using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.DTOs.Make
{
	public class MakeSpecParams : PaginationSpecParams
	{
		public bool? IsActive { get; set; }
	}
}
