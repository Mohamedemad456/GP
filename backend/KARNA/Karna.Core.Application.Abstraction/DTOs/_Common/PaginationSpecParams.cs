using System;

namespace Karna.Core.Application.Abstraction.DTOs._Common
{
	public class PaginationSpecParams
	{
		private const int MaxPageSize = 10;
		private int pageSize = 5;

		public int PageIndex { get; set; } = 1;

		public int PageSize
		{
			get => pageSize;
			set => pageSize = value > MaxPageSize ? MaxPageSize : value < 1 ? 5 : value;
		}

		public string? Search { get; set; }
		public string? Sort { get; set; } = "createdAt";
		public string? SortDirection { get; set; } = "desc";
	}
}
