using Karna.Core.Application.Abstraction.DTOs.Admin;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.Admin
{
	public class AdminActivityLogsSpecification : BaseSpecification<AdminActivityLog>
	{
		public AdminActivityLogsSpecification(AdminActivityLogSpecParams specParams, bool applyPaging = true)
			: base(log =>
				(!specParams.AdminId.HasValue || log.AdminId == specParams.AdminId.Value)
				&&
				(string.IsNullOrEmpty(specParams.Action) || log.Action == specParams.Action)
				&&
				(string.IsNullOrEmpty(specParams.EntityType) || log.EntityType == specParams.EntityType)
				&&
				(!specParams.DateFrom.HasValue || log.PerformedAt >= specParams.DateFrom.Value)
				&&
				(!specParams.DateTo.HasValue || log.PerformedAt <= specParams.DateTo.Value))
		{
			AddInclude(log => log.Admin);

			AddOrderByDescending(log => log.PerformedAt);

			if (applyPaging)
				ApplyPaging((specParams.PageIndex - 1) * specParams.PageSize, specParams.PageSize);
		}
	}
}
