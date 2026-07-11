using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.Models
{
    public class ModelWithMakeSpecification : BaseSpecification<Model>
    {
        public ModelWithMakeSpecification()
        {
            AddInclude(x => x.Make);
        }

        public ModelWithMakeSpecification(Guid id)
            : base(x => x.Id == id)
        {
            AddInclude(x => x.Make);
        }
    }
    
}
