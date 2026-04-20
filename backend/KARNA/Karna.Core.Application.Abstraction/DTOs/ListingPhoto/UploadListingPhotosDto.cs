using System;
using System.Collections.Generic;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace Karna.Core.Application.Abstraction.DTOs.ListingPhoto
{
    public class UploadListingPhotosDto
    {
        public List<IFormFile> Files { get; set; } = new();
    }
}
