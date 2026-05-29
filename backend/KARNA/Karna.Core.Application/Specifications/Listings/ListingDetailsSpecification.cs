using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Specifications.Listings
{
	public class ListingDetailsSpecification : BaseSpecification<Listing>
	{
		public ListingDetailsSpecification(Guid listingId)
			: base(l =>
				l.Id == listingId
				&& l.Status == ListingStatus.Active
				&& !l.IsDeleted)
		{
			AddInclude(l => l.Make);
			AddInclude(l => l.Model);
			AddInclude(l => l.Seller);
			AddInclude(l => l.Photos);
			AddInclude(l => l.ListingDefects);
		}
	}
}
