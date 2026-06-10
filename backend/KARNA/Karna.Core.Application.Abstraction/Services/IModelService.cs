using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Model;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IModelService
	{
		Task<ApiResponse<ModelDto>> GetByIdAsync(Guid id);
		Task<ApiResponse<Pagination<ModelDto>>> GetAllAsync(ModelSpecParams specParams);
		Task<ApiResponse<Pagination<ModelDto>>> GetAllActiveAsync(PaginationSpecParams specParams);
		Task<ApiResponse<ModelDto>> CreateAsync(CreateModelDto dto);
		Task<ApiResponse<ModelDto>> UpdateAsync(Guid id, UpdateModelDto dto);
		Task<ApiResponseDto> ActivateAsync(Guid id);
		Task<ApiResponseDto> DeactivateAsync(Guid id);
		Task<ApiResponseDto> DeleteAsync(Guid id);
	}
}
