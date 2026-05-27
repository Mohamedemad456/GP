using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Admin;

namespace Karna.Core.Application.Abstraction.Services
{
	public interface IAdminActivityLogService
	{
		Task LogAsync(Guid adminId, string action, string entityType, Guid entityId, string? details);
		Task<ApiResponse<Pagination<AdminActivityLogDto>>> GetLogsAsync(AdminActivityLogSpecParams specParams);
	}
}
