using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Application.Abstraction.DTOs.Model;

namespace Karna.Core.Application.Abstraction.Services
{
    public interface IModelService
    {
        Task<ApiResponse<ModelDto>> GetByIdAsync(Guid id);
        Task<ApiResponse<IEnumerable<ModelDto>>> GetAllAsync();
        Task<ApiResponse<IEnumerable<ModelDto>>> GetAllActiveAsync();
        Task<ApiResponse<ModelDto>> CreateAsync(CreateModelDto dto);
        Task<ApiResponse<ModelDto>> UpdateAsync(Guid id, UpdateModelDto dto);
        Task<ApiResponseDto> ToggleActiveAsync(Guid id);
        Task<ApiResponseDto> DeleteAsync(Guid id);
    }
}
