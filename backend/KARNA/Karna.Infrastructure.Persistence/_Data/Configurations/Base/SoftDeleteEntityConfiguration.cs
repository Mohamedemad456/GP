using Karna.Core.Domain._Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Data.Configurations.Base
{
	internal abstract class SoftDeleteEntityConfiguration<TEntity> 
		: BaseAuditableEntityConfiguration<TEntity>
		where TEntity : SoftDeleteEntity
	{
		public override void Configure(EntityTypeBuilder<TEntity> builder)
		{
			base.Configure(builder);

			builder.Property(e => e.IsDeleted)
				.IsRequired()
				.HasDefaultValue(false);
		}
	}
}
