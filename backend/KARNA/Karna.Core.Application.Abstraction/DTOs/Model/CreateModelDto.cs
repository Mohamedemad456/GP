using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.DTOs.Model
{
    public class CreateModelDto
    {
        public string Name { get; set; } = null!;
        public string NameAr { get; set; } = null!;
        public Guid MakeId { get; set; }
    }
}
