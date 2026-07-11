using Karna.Core.Domain._Common;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Data.Configurations.Base
{
	public abstract class BaseAuditableEntityConfiguration<TEntity>
		:BaseEntityConfiguration<TEntity>
		where TEntity : BaseAuditableEntity
	{
		public override void Configure(EntityTypeBuilder<TEntity> builder)
		{
			base.Configure(builder);

			builder.Property(e => e.CreatedAt)
				.IsRequired();

			builder.Property(e => e.UpdatedAt)
				.IsRequired(false);
		}
	}
}
