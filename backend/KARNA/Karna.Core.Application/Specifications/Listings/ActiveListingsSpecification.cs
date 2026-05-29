using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Specifications.Listings
{
	public class ActiveListingsSpecification : BaseSpecification<Listing>
	{
		public ActiveListingsSpecification(BuyerListingSpecParams specParams, bool applyPaging = true)
			: base(l =>
				l.Status == ListingStatus.Active
				&& !l.IsDeleted
				&&
				(!specParams.MakeId.HasValue || l.MakeId == specParams.MakeId.Value)
				&&
				(!specParams.ModelId.HasValue || l.ModelId == specParams.ModelId.Value)
				&&
				(!specParams.YearFrom.HasValue || l.Year >= specParams.YearFrom.Value)
				&&
				(!specParams.YearTo.HasValue || l.Year <= specParams.YearTo.Value)
				&&
				(!specParams.PriceMin.HasValue || l.Price >= specParams.PriceMin.Value)
				&&
				(!specParams.PriceMax.HasValue || l.Price <= specParams.PriceMax.Value)
				&&
				(!specParams.MileageMin.HasValue || l.Mileage >= specParams.MileageMin.Value)
				&&
				(!specParams.MileageMax.HasValue || l.Mileage <= specParams.MileageMax.Value))
		{
			AddInclude(l => l.Make);
			AddInclude(l => l.Model);
			AddInclude(l => l.Photos);

			// Dynamic sorting — fallback to newest (CreatedAt DESC)
			var isAsc = string.Equals(specParams.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);

			switch (specParams.Sort?.ToLowerInvariant())
			{
				case "price":
					if (isAsc) AddOrderBy(l => l.Price!);
					else AddOrderByDescending(l => l.Price!);
					break;

				case "year":
					if (isAsc) AddOrderBy(l => l.Year);
					else AddOrderByDescending(l => l.Year);
					break;

				case "mileage":
					if (isAsc) AddOrderBy(l => l.Mileage);
					else AddOrderByDescending(l => l.Mileage);
					break;

				default: // "createdAt" or anything else → newest first
					if (isAsc) AddOrderBy(l => l.CreatedAt);
					else AddOrderByDescending(l => l.CreatedAt);
					break;
			}

			if (applyPaging)
				ApplyPaging((specParams.PageIndex - 1) * specParams.PageSize, specParams.PageSize);
		}
	}
}
