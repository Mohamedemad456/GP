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
				(!specParams.PriceMax.HasValue || l.Price <= specParams.PriceMax.Value))
		{
			AddInclude(l => l.Make);
			AddInclude(l => l.Model);
			AddInclude(l => l.Photos);

			AddOrderByDescending(l => l.CreatedAt);

			if (applyPaging)
				ApplyPaging((specParams.PageIndex - 1) * specParams.PageSize, specParams.PageSize);
		}
	}
}
