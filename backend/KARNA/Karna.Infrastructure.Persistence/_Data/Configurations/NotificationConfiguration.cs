using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	internal class NotificationConfiguration : BaseAuditableEntityConfiguration<Notification>
	{
		public override void Configure(EntityTypeBuilder<Notification> builder)
		{
			base.Configure(builder);

			builder.Property(x => x.UserId)
				.IsRequired();

			builder.Property(x => x.Title)
				.IsRequired()
				.HasMaxLength(256);

			builder.Property(x => x.Message)
				.IsRequired()
				.HasMaxLength(1024);

			builder.Property(x => x.IsRead)
				.IsRequired()
				.HasDefaultValue(false);

			builder.HasIndex(x => x.UserId);

			builder.HasIndex(x => new { x.UserId, x.IsRead });

			builder.HasOne(x => x.User)
				.WithMany()
				.HasForeignKey(x => x.UserId)
				.OnDelete(DeleteBehavior.Restrict);

			builder.HasOne(x => x.Listing)
				.WithMany()
				.HasForeignKey(x => x.ListingId)
				.OnDelete(DeleteBehavior.SetNull);
		}
	}
}
