using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.DTOs._Common
{
	public class Pagination<T>(int pageIndex, int pageSize, int count)
	{
		public required IEnumerable<T> Data { get; set; }
		public int PageIndex { get; set; } = pageIndex;
		public int PageSize { get; set; } = pageSize;
		public int Count { get; set; } = count;



	}
}
