using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
    public class Favorite : BaseAuditableEntity
    {
        public Guid UserId { get; set; }
        public User User { get; set; } = null!;

        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

    }
}
