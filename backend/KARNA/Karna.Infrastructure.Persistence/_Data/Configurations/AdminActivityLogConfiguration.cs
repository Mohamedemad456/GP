using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	internal class AdminActivityLogConfiguration : BaseEntityConfiguration<AdminActivityLog>
	{
		public override void Configure(EntityTypeBuilder<AdminActivityLog> builder)
		{
			base.Configure(builder);

			builder.Property(x => x.AdminId)
				.IsRequired();

			builder.Property(x => x.Action)
				.IsRequired()
				.HasMaxLength(50);

			builder.Property(x => x.EntityType)
				.IsRequired()
				.HasMaxLength(50);

			builder.Property(x => x.EntityId)
				.IsRequired();

			builder.Property(x => x.Details)
				.IsRequired(false)
				.HasMaxLength(1000);

			builder.Property(x => x.PerformedAt)
				.IsRequired();

			builder.HasIndex(x => x.AdminId);
			builder.HasIndex(x => x.PerformedAt);

			builder.HasOne(x => x.Admin)
				.WithMany()
				.HasForeignKey(x => x.AdminId)
				.OnDelete(DeleteBehavior.Restrict);
		}
	}
}
