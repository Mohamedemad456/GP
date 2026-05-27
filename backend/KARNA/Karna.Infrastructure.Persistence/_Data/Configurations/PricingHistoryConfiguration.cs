using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	internal class PricingHistoryConfiguration : BaseEntityConfiguration<PricingHistory>
	{
		public override void Configure(EntityTypeBuilder<PricingHistory> builder)
		{
			base.Configure(builder);

			builder.Property(x => x.ListingId)
				.IsRequired();

			builder.Property(x => x.OldPrice)
				.HasPrecision(18, 2);

			builder.Property(x => x.NewPrice)
				.HasPrecision(18, 2);

			builder.Property(x => x.OldFairPrice)
				.HasPrecision(18, 2);

			builder.Property(x => x.NewFairPrice)
				.HasPrecision(18, 2);

			builder.Property(x => x.ChangeReason)
				.IsRequired(false)
				.HasMaxLength(200);

			builder.Property(x => x.ChangedAt)
				.IsRequired();

			builder.HasIndex(x => x.ListingId);
			builder.HasIndex(x => x.ChangedAt);

			builder.HasOne(x => x.Listing)
				.WithMany()
				.HasForeignKey(x => x.ListingId)
				.OnDelete(DeleteBehavior.Restrict);

			builder.HasOne(x => x.ChangedByUser)
				.WithMany()
				.HasForeignKey(x => x.ChangedByUserId)
				.OnDelete(DeleteBehavior.Restrict)
				.IsRequired(false);

			builder.HasQueryFilter(ld => !ld.Listing.IsDeleted);
		}
	}
}
