using System;

namespace Karna.Core.Application.Abstraction.DTOs._Common
{
	public class PaginationSpecParams
	{
		private const int MaxPageSize = 20;
		private int? _pageSize;

		public int PageIndex { get; set; } = 1;

		public int PageSize
		{
			get => _pageSize ?? 10;
			set => _pageSize = value > MaxPageSize ? MaxPageSize : value < 1 ? 10 : value;
		}

		/// <summary>
		/// True when the client explicitly sent pageSize in the query string.
		/// False when no pagination params were provided (default = return all).
		/// </summary>
		public bool IsPagingRequested => _pageSize.HasValue;

		public string? Search { get; set; }
		public string? Sort { get; set; } = "createdAt";
		public string? SortDirection { get; set; } = "desc";
	}
}
