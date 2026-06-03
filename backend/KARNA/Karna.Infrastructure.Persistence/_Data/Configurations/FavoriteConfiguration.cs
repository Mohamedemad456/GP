using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
    internal class FavoriteConfiguration : BaseAuditableEntityConfiguration<Favorite>
    {
        public override void Configure(EntityTypeBuilder<Favorite> builder)
        {
            base.Configure(builder);

            builder.Property(x => x.UserId)
                .IsRequired();

            builder.Property(x => x.ListingId)
                .IsRequired();

            builder.HasIndex(x => x.UserId);

            builder.HasIndex(x => x.ListingId);

            builder.HasIndex(x => new
            {
                x.UserId,
                x.ListingId
            })
            .IsUnique();

            builder.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(x => x.Listing)
                .WithMany(x => x.Favorites)
                .HasForeignKey(x => x.ListingId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasQueryFilter(x => !x.Listing.IsDeleted);
        }


    }
}
