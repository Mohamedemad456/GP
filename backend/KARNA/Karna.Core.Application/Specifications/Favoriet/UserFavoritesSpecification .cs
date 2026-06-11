using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Application.Abstraction.DTOs._Common;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;

namespace Karna.Core.Application.Specifications.Favoriet
{
    public class UserFavoritesSpecification : BaseSpecification<Favorite>
    {
        public UserFavoritesSpecification(
        Guid userId,
        PaginationSpecParams specParams,
        bool applyPaging = true)
        : base(x =>
            x.UserId == userId &&
            x.Listing.Status != ListingStatus.Draft &&
            x.Listing.Status != ListingStatus.Rejected)
        {
            AddInclude(x => x.Listing);
            AddInclude(x => x.Listing.Make);
            AddInclude(x => x.Listing.Model);
            AddInclude(x => x.Listing.Photos);

            AddOrderByDescending(x => x.CreatedAt);

            if (applyPaging)
            {
                ApplyPaging(
                    (specParams.PageIndex - 1) * specParams.PageSize,
                    specParams.PageSize);
            }
        }
    }
}
