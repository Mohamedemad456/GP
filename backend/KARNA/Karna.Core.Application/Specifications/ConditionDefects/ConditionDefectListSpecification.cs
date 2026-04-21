using System;
using Karna.Core.Application.Abstraction.DTOs.ConditionDefect;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.ConditionDefects
{
	public class ConditionDefectListSpecification : BaseSpecification<ConditionDefect>
	{
		public ConditionDefectListSpecification(
			ConditionDefectSpecParams specParams,
			bool activeOnly = false,
			bool applyPaging = true,
			bool includeCategory = true)
			: base(d =>
				(string.IsNullOrWhiteSpace(specParams.Search)
					|| d.ItemName.Contains(specParams.Search)
					|| d.ItemNameAr.Contains(specParams.Search))
				&&
				(!specParams.CategoryId.HasValue || d.CategoryId == specParams.CategoryId.Value)
				&&
				(activeOnly
					? d.IsActive
					: (!specParams.IsActive.HasValue || d.IsActive == specParams.IsActive.Value)))
		{
			if (includeCategory)
				AddInclude(d => d.Category);

			var isDescending = string.Equals(specParams.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);

			switch (specParams.Sort?.Trim().ToLowerInvariant())
			{
				case "name":
					if (isDescending) AddOrderByDescending(d => d.ItemName);
					else AddOrderBy(d => d.ItemName);
					break;

				case "createdat":
				default:
					if (isDescending) AddOrderByDescending(d => d.CreatedAt);
					else AddOrderBy(d => d.CreatedAt);
					break;
			}

			if (applyPaging)
				ApplyPaging((specParams.PageIndex - 1) * specParams.PageSize, specParams.PageSize);
		}
	}
}