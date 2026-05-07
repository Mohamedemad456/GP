using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	internal class ListingStatusHistoryConfiguration : BaseEntityConfiguration<ListingStatusHistory>
	{
		public override void Configure(EntityTypeBuilder<ListingStatusHistory> builder)
		{
			base.Configure(builder);

			builder.Property(x => x.ListingId)
				.IsRequired();

			builder.Property(x => x.OldStatus)
				.IsRequired()
				.HasConversion<string>()
				.HasMaxLength(20);

			builder.Property(x => x.NewStatus)
				.IsRequired()
				.HasConversion<string>()
				.HasMaxLength(20);

			builder.Property(x => x.ChangedByUserId)
				.IsRequired(false);

			builder.Property(x => x.Reason)
				.IsRequired(false)
				.HasMaxLength(500);

			builder.Property(x => x.ChangedAt)
				.IsRequired();

			builder.HasIndex(x => x.ListingId);

			builder.HasOne(x => x.Listing)
				.WithMany(x => x.StatusHistories)
				.HasForeignKey(x => x.ListingId)
				.OnDelete(DeleteBehavior.Restrict);

			builder.HasOne(x => x.ChangedByUser)
				.WithMany()
				.HasForeignKey(x => x.ChangedByUserId)
				.OnDelete(DeleteBehavior.SetNull);

			builder.HasQueryFilter(lsh => !lsh.Listing.IsDeleted);
		}
	}
}
