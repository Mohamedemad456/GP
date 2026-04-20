using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	internal class ListingDefectConfiguration : BaseEntityConfiguration<ListingDefect>
	{
		public override void Configure(EntityTypeBuilder<ListingDefect> builder)
		{
			base.Configure(builder);

			builder.Property(x => x.AppliedAt)
				.IsRequired();

			builder.HasIndex(x => x.ListingId);

			builder.HasIndex(x => new { x.ListingId, x.ConditionDefectId })
				.IsUnique();

			builder.HasOne(x => x.Listing)
				.WithMany(x => x.ListingDefects)
				.HasForeignKey(x => x.ListingId)
				.OnDelete(DeleteBehavior.Restrict);

			builder.HasOne(x => x.ConditionDefect)
				.WithMany(x => x.ListingDefects)
				.HasForeignKey(x => x.ConditionDefectId)
				.OnDelete(DeleteBehavior.Restrict);

			builder.HasQueryFilter(ld => !ld.Listing.IsDeleted);
		}
	}
}
