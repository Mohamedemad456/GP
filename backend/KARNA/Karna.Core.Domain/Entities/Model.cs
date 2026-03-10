using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Domain._Common;

namespace Karna.Core.Domain.Entities
{
    public class Model : BaseAuditableWithSoftDeleteEntity
    {
        public required string Name { get; set; }
        public required string NameAr { get; set; }
        public bool IsActive { get; set; } 

        public Guid MakeId { get; set; }
        public Make Make {  get; set; } = null!;
    }
}
