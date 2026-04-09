using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.ConditionDefect;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IConditionDefectService
	{
		Task<ApiResponse<ConditionDefectDto>> GetByIdAsync(Guid id);
		Task<ApiResponse<IEnumerable<ConditionDefectDto>>> GetAllAsync();
		Task<ApiResponse<IEnumerable<ConditionDefectDto>>> GetAllActiveAsync();
		Task<ApiResponse<ConditionDefectDto>> CreateAsync(CreateConditionDefectDto dto);
		Task<ApiResponse<ConditionDefectDto>> UpdateAsync(Guid id, UpdateConditionDefectDto dto);
		Task<ApiResponseDto> DeleteAsync(Guid id);
		Task<ApiResponseDto> ActivateAsync(Guid id);
		Task<ApiResponseDto> DeactivateAsync(Guid id);
	}
}
