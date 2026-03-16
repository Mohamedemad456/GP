using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.ConditionChecklistCategory;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IConditionChecklistCategoryService
	{
		Task<ApiResponse<ConditionChecklistCategoryDto>> GetByIdAsync(Guid id);
		Task<ApiResponse<IEnumerable<ConditionChecklistCategoryDto>>> GetAllAsync();
		Task<ApiResponse<IEnumerable<ConditionChecklistCategoryDto>>> GetAllActiveAsync();
		Task<ApiResponse<ConditionChecklistCategoryDto>> CreateAsync(CreateConditionChecklistCategoryDto dto);
		Task<ApiResponse<ConditionChecklistCategoryDto>> UpdateAsync(Guid id, UpdateConditionChecklistCategoryDto dto);
		Task<ApiResponseDto> DeleteAsync(Guid id);
		Task<ApiResponseDto> ActivateAsync(Guid id);
		Task<ApiResponseDto> DeactivateAsync(Guid id);
	}
}