using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
    public class ListingPhoto : BaseAuditableWithSoftDeleteEntity
    {
        public string PhotoUrl { get; set; } = string.Empty;
        public bool IsPrimary { get; set; }
        public int DisplayOrder { get; set; }
        public DateTime UploadedAt { get; set; }
        public Guid ListingId { get; set; }
        public Listing Listing { get; set; } = null!;

    }

}