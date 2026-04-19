using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.DTOs.ListingPhoto
{
    public class ListingPhotoDto
    {
        public Guid Id { get; set; }
        public string PhotoUrl { get; set; } = string.Empty;
        public bool IsPrimary { get; set; }
        public int DisplayOrder { get; set; }
    }
}
