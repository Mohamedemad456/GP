using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.DTOs.Admin
{
	public class UserListSpecParams : PaginationSpecParams
	{
		public bool? IsActive { get; set; }
	}
}
