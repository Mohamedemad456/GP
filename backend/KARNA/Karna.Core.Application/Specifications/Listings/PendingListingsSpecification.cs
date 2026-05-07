using Karna.Core.Application.Abstraction.DTOs.Listing;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Specifications.Listings
{
	public class PendingListingsSpecification : BaseSpecification<Listing>
	{
		public PendingListingsSpecification(PendingListingSpecParams specParams, bool applyPaging = true)
			: base(l =>
				l.Status == ListingStatus.Pending
				&& !l.IsDeleted
				&&
				(!specParams.MakeId.HasValue || l.MakeId == specParams.MakeId.Value)
				&&
				(!specParams.ModelId.HasValue || l.ModelId == specParams.ModelId.Value)
				&&
				(!specParams.SellerId.HasValue || l.SellerId == specParams.SellerId.Value)
				&&
				(!specParams.DateFrom.HasValue || l.CreatedAt >= specParams.DateFrom.Value)
				&&
				(!specParams.DateTo.HasValue || l.CreatedAt <= specParams.DateTo.Value))
		{
			AddInclude(l => l.Seller);
			AddInclude(l => l.Make);
			AddInclude(l => l.Model);

			AddOrderByDescending(l => l.CreatedAt);

			if (applyPaging)
				ApplyPaging((specParams.PageIndex - 1) * specParams.PageSize, specParams.PageSize);
		}
	}
}
