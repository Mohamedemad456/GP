using Karna.Core.Application.Abstraction.DTOs.Admin;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.Admin
{
	public class AllUsersSpecification : BaseSpecification<User>
	{
		public AllUsersSpecification(UserListSpecParams specParams, bool applyPaging = true)
			: base(u =>
				(!specParams.IsActive.HasValue || u.IsActive == specParams.IsActive.Value)
				&&
				(string.IsNullOrEmpty(specParams.Search) || u.Name.Contains(specParams.Search)))
		{
			var isAsc = string.Equals(specParams.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);

			switch (specParams.Sort?.ToLowerInvariant())
			{
				case "name":
					if (isAsc) AddOrderBy(u => u.Name);
					else AddOrderByDescending(u => u.Name);
					break;

				default: // "createdAt" or anything else → newest first
					if (isAsc) AddOrderBy(u => u.CreatedAt);
					else AddOrderByDescending(u => u.CreatedAt);
					break;
			}

			if (applyPaging)
				ApplyPaging((specParams.PageIndex - 1) * specParams.PageSize, specParams.PageSize);
		}
	}
}
