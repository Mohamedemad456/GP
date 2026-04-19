using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
    internal class ListingPhotoConfiguration : SoftDeleteEntityConfiguration<ListingPhoto>
    {
        public override void Configure(EntityTypeBuilder<ListingPhoto> builder) 
        {
            base.Configure(builder);

            builder.Property(x => x.PhotoUrl)
            .IsRequired();

            builder.Property(x => x.ListingId)
                .IsRequired();

            builder.HasOne(x => x.Listing)
            .WithMany(l => l.Photos)
            .HasForeignKey(x => x.ListingId)
            .OnDelete(DeleteBehavior.Cascade);

            builder.HasIndex(x => x.ListingId);


        }
    }
}
