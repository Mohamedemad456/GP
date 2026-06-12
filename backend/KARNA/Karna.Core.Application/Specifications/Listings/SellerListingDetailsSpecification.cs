using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.Listings
{
	/// <summary>
	/// Loads a single listing for the owner (or all if admin) — no status gate (all statuses allowed),
	/// includes all navigation needed to build MyListingDetailsDto.
	/// </summary>
	public class SellerListingDetailsSpecification : BaseSpecification<Listing>
	{
		public SellerListingDetailsSpecification(Guid listingId, Guid? sellerId = null)
			: base(l =>
				l.Id == listingId
				&& (!sellerId.HasValue || l.SellerId == sellerId.Value)
				&& !l.IsDeleted)
		{
			AddInclude(l => l.Make);
			AddInclude(l => l.Model);
			AddInclude(l => l.Photos);
			AddInclude(l => l.ListingDefects);
		}
	}
}
