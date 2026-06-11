using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Specifications.Listings
{
	public class SellerListingsSpecification : BaseSpecification<Listing>
	{
		public SellerListingsSpecification(Guid sellerId, MyListingSpecParams specParams, bool applyPaging = true)
			: base(BuildCriteria(sellerId, specParams))
		{
			AddInclude(l => l.Make);
			AddInclude(l => l.Model);
			AddInclude(l => l.Photos);
			AddInclude(l => l.ListingDefects);

			// Dynamic sorting — fallback to newest (CreatedAt DESC)
			var isAsc = string.Equals(specParams.SortDirection, "asc", StringComparison.OrdinalIgnoreCase);

			switch (specParams.Sort?.ToLowerInvariant())
			{
				case "price":
					if (isAsc) AddOrderBy(l => l.Price!);
					else AddOrderByDescending(l => l.Price!);
					break;

				case "updatedat":
					if (isAsc) AddOrderBy(l => l.UpdatedAt!);
					else AddOrderByDescending(l => l.UpdatedAt!);
					break;

				default: // "createdAt" or anything else → newest first
					if (isAsc) AddOrderBy(l => l.CreatedAt);
					else AddOrderByDescending(l => l.CreatedAt);
					break;
			}

			if (applyPaging)
				ApplyPaging((specParams.PageIndex - 1) * specParams.PageSize, specParams.PageSize);
		}

		private static System.Linq.Expressions.Expression<Func<Listing, bool>> BuildCriteria(
			Guid sellerId, MyListingSpecParams specParams)
		{
			// Parse status outside the expression tree (cannot use out vars inside lambdas)
			ListingStatus? statusFilter = null;
			if (!string.IsNullOrWhiteSpace(specParams.Status)
				&& Enum.TryParse<ListingStatus>(specParams.Status, true, out var parsed))
			{
				statusFilter = parsed;
			}

			return l =>
				l.SellerId == sellerId
				&& !l.IsDeleted
				&&
				(!statusFilter.HasValue || l.Status == statusFilter.Value)
				&&
				(!specParams.MakeId.HasValue || l.MakeId == specParams.MakeId.Value)
				&&
				(!specParams.ModelId.HasValue || l.ModelId == specParams.ModelId.Value);
		}
	}
}

