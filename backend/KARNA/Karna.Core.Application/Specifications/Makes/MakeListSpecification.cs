using System;
using Karna.Core.Application.Abstraction.DTOs.Make;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.Makes
{
	public class MakeListSpecification : BaseSpecification<Make>
	{
		public MakeListSpecification(MakeSpecParams specParams, bool activeOnly = false, bool applyPaging = true)
			: base(m =>
				(string.IsNullOrWhiteSpace(specParams.Search)
					|| m.Name.Contains(specParams.Search)
					|| m.NameAr.Contains(specParams.Search))
				&&
				(activeOnly
					? m.IsActive
					: (!specParams.IsActive.HasValue || m.IsActive == specParams.IsActive.Value)))
		{
			var isDescending = string.Equals(specParams.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);

			switch (specParams.Sort?.Trim().ToLowerInvariant())
			{
				case "name":
					if (isDescending) AddOrderByDescending(m => m.Name);
					else AddOrderBy(m => m.Name);
					break;

				case "namear":
					if (isDescending) AddOrderByDescending(m => m.NameAr);
					else AddOrderBy(m => m.NameAr);
					break;

				case "country":
					if (isDescending) AddOrderByDescending(m => m.Country!);
					else AddOrderBy(m => m.Country!);
					break;
				case "countryar":
					if (isDescending) AddOrderByDescending(m => m.CountryAr!);
					else AddOrderBy(m => m.CountryAr!);
					break;

				case "createdat":
				default:
					if (isDescending) AddOrderByDescending(m => m.CreatedAt);
					else AddOrderBy(m => m.CreatedAt);
					break;
			}

			if (applyPaging)
				ApplyPaging((specParams.PageIndex - 1) * specParams.PageSize, specParams.PageSize);
		}
	}
}
