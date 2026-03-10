using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.DTOs.Model
{
    public class UpdateModelDto
    {
        public string Name { get; set; } = null!;
        public string NameAr { get; set; } = null!;
        public bool IsActive { get; set; }
        public Guid MakeId { get; set; }
    }
}
