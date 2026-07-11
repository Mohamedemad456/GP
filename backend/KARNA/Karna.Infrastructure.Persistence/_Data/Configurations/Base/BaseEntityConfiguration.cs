using Karna.Core.Domain._Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Data.Configurations.Base
{
	public abstract class BaseEntityConfiguration<TEntity>
		: IEntityTypeConfiguration<TEntity>
		where TEntity : BaseEntity
	{
		public virtual void Configure(EntityTypeBuilder<TEntity> builder)
		{
			builder.HasKey(e => e.Id);

			builder.Property(e => e.Id)
				.ValueGeneratedNever();
		}
	}
}
