using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Application.Abstraction.Persistence;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Specifications.Models
{
    public class ActiveModelsWithMakeSpec : BaseSpecification<Model>
    {
        public ActiveModelsWithMakeSpec() : base(x => x.IsActive)
        {
            AddInclude(m => m.Make);
            AddOrderByDescending(m => m.CreatedAt);

        }
    }
}
