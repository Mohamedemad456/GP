using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.DTOs.Admin;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Application.Abstraction.Services;
using Karna.Core.Application.Mapping;
using Karna.Core.Application.Specifications.Admin;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Services
{
	internal class AdminActivityLogService(IUnitOfWork _unitOfWork) : IAdminActivityLogService
	{
		public async Task LogAsync(Guid adminId, string action, string entityType, Guid entityId, string? details)
		{
			var logRepo = _unitOfWork.GetRepository<AdminActivityLog>();
			await logRepo.AddAsync(new AdminActivityLog
			{
				AdminId = adminId,
				Action = action,
				EntityType = entityType,
				EntityId = entityId,
				Details = details,
				PerformedAt = DateTime.UtcNow
			});
		}

		public async Task<ApiResponse<Pagination<AdminActivityLogDto>>> GetLogsAsync(AdminActivityLogSpecParams specParams)
		{
			var repo = _unitOfWork.GetRepository<AdminActivityLog>();

			var dataSpec = new AdminActivityLogsSpecification(specParams, applyPaging: true);
			var countSpec = new AdminActivityLogsSpecification(specParams, applyPaging: false);

			var logs = await repo.GetAllWithSpecAsync(dataSpec);
			var count = await repo.GetCountAsync(countSpec);

			return new ApiResponse<Pagination<AdminActivityLogDto>>
			{
				Success = true,
				Data = new Pagination<AdminActivityLogDto>(specParams.PageIndex, specParams.PageSize, count)
				{
					Data = logs.ToDto()
				}
			};
		}
	}
}
