using Karna.Core.Application.Abstraction.DTOs._Common;

namespace Karna.Core.Application.Abstraction.DTOs.Model
{
	public class ModelSpecParams : PaginationSpecParams
	{
		public Guid? MakeId { get; set; }
		public bool? IsActive { get; set; }
	}
}