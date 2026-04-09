using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	internal class ConditionDefectConfiguration : BaseAuditableEntityConfiguration<ConditionDefect>
	{
		public override void Configure(EntityTypeBuilder<ConditionDefect> builder)
		{
			base.Configure(builder);

			builder.Property(x => x.ItemName)
				.IsRequired()
				.HasMaxLength(200);

			builder.Property(x => x.ItemNameAr)
				.IsRequired()
				.HasMaxLength(200);

			builder.Property(x => x.Description)
				.HasMaxLength(500);

			builder.Property(x => x.DescriptionAr)
				.HasMaxLength(500);

			builder.Property(x => x.IsActive)
				.HasDefaultValue(true);

			builder.HasIndex(x => new { x.CategoryId, x.ItemName })
				.IsUnique();

			builder.HasIndex(x => new { x.CategoryId, x.ItemNameAr })
				.IsUnique();

			builder.HasOne(x => x.Category)
				.WithMany(x => x.ConditionDefects)
				.HasForeignKey(x => x.CategoryId)
				.OnDelete(DeleteBehavior.Restrict);
		}
	}
}
