using System;
using Karna.Core.Application.Abstraction.DTOs.Model;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.Models
{
	public class ModelListSpecification : BaseSpecification<Model>
	{
		public ModelListSpecification(ModelSpecParams specParams, bool activeOnly = false, bool applyPaging = true)
			: base(m =>
				(string.IsNullOrWhiteSpace(specParams.Search)
					|| m.Name.Contains(specParams.Search)
					|| m.NameAr.Contains(specParams.Search))
				&&
				(!specParams.MakeId.HasValue || m.MakeId == specParams.MakeId.Value)
				&&
				(activeOnly
					? m.IsActive
					: (!specParams.IsActive.HasValue || m.IsActive == specParams.IsActive.Value)))
		{
			AddInclude(m => m.Make);

			var isDescending = string.Equals(specParams.SortDirection, "desc", StringComparison.OrdinalIgnoreCase);

			switch (specParams.Sort?.Trim().ToLowerInvariant())
			{
				case "name":
					if (isDescending) AddOrderByDescending(m => m.Name);
					else AddOrderBy(m => m.Name);
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