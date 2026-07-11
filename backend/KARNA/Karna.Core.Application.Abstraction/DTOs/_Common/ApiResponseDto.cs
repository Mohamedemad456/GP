using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.DTOs._Common
{
	public class ApiResponseDto
	{
		public bool Success { get; set; }
		public string Message { get; set; } = string.Empty;
	}
	public class ApiResponse<T> : ApiResponseDto
	{
		public T? Data { get; set; }
	}
}

