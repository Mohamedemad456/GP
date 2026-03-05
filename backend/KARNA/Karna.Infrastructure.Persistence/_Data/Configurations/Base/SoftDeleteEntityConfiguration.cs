using Karna.Core.Domain._Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations.Base
{
	internal abstract class SoftDeleteEntityConfiguration<TEntity>
		: BaseAuditableEntityConfiguration<TEntity>
		where TEntity : BaseAuditableEntity, ISoftDelete
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
