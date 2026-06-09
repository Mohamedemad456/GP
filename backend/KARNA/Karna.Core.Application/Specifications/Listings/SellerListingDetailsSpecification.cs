using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.Listings
{
	/// <summary>
	/// Loads a single listing for the owner — no status gate (all statuses allowed),
	/// includes all navigation needed to build MyListingDetailsDto.
	/// Defects navigation (ConditionDefect → Category) is loaded separately in
	/// the service because EF Core doesn't support nested ThenInclude on ICollection splits.
	/// </summary>
	public class SellerListingDetailsSpecification : BaseSpecification<Listing>
	{
		public SellerListingDetailsSpecification(Guid listingId, Guid sellerId)
			: base(l =>
				l.Id == listingId
				&& l.SellerId == sellerId
				&& !l.IsDeleted)
		{
			AddInclude(l => l.Make);
			AddInclude(l => l.Model);
			AddInclude(l => l.Photos);
			AddInclude(l => l.ListingDefects);
		}
	}
}
