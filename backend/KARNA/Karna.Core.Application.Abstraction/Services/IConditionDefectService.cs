using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.ConditionDefect;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IConditionDefectService
	{
		Task<ApiResponse<ConditionDefectDto>> GetByIdAsync(Guid id);
		Task<ApiResponse<Pagination<ConditionDefectDto>>> GetAllAsync(ConditionDefectSpecParams specParams);
		Task<ApiResponse<Pagination<ConditionDefectDto>>> GetAllActiveAsync(PaginationSpecParams specParams);
		Task<ApiResponse<ConditionDefectDto>> CreateAsync(CreateConditionDefectDto dto);
		Task<ApiResponse<ConditionDefectDto>> UpdateAsync(Guid id, UpdateConditionDefectDto dto);
		Task<ApiResponseDto> DeleteAsync(Guid id);
		Task<ApiResponseDto> ActivateAsync(Guid id);
		Task<ApiResponseDto> DeactivateAsync(Guid id);
	}
}
