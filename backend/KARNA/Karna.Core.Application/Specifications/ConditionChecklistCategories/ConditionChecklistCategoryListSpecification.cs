using System;
using Karna.Core.Application.Abstraction.DTOs.ConditionChecklistCategory;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.ConditionChecklistCategories
{
	public class ConditionChecklistCategoryListSpecification : BaseSpecification<ConditionChecklistCategory>
	{
		public ConditionChecklistCategoryListSpecification(
			ConditionChecklistCategorySpecParams specParams,
			bool activeOnly = false,
			bool applyPaging = true)
			: base(c =>
				(string.IsNullOrWhiteSpace(specParams.Search)
					|| c.Name.Contains(specParams.Search)
					|| c.NameAr.Contains(specParams.Search))
				&&
				(activeOnly
					? c.IsActive
					: (!specParams.IsActive.HasValue || c.IsActive == specParams.IsActive.Value)))
		{
			var isDescending = string.Equals(specParams.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);

			switch (specParams.Sort?.Trim().ToLowerInvariant())
			{
				case "name":
					if (isDescending) AddOrderByDescending(c => c.Name);
					else AddOrderBy(c => c.Name);
					break;

				case "createdat":
				default:
					if (isDescending) AddOrderByDescending(c => c.CreatedAt);
					else AddOrderBy(c => c.CreatedAt);
					break;
			}

			if (applyPaging)
				ApplyPaging((specParams.PageIndex - 1) * specParams.PageSize, specParams.PageSize);
		}
	}
}