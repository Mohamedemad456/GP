using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Make;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IMakeService
	{
		Task<ApiResponse<MakeDto>> GetByIdAsync(Guid id);
		Task<ApiResponse<IEnumerable<MakeDto>>> GetAllAsync();
		Task<ApiResponse<IEnumerable<MakeDto>>> GetAllActiveAsync();
		Task<ApiResponse<MakeDto>> CreateAsync(CreateMakeDto dto);
		Task<ApiResponse<MakeDto>> UpdateAsync(Guid id, UpdateMakeDto dto);
		Task<ApiResponseDto> ActivateAsync(Guid id);
		Task<ApiResponseDto> DeactivateAsync(Guid id);
		Task<ApiResponseDto> DeleteAsync(Guid id);
	}
}