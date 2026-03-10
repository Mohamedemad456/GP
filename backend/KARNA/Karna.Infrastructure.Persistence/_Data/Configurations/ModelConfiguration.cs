using System;
using System.Collections.Generic;
using System.Text;
using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
    internal class ModelConfiguration : SoftDeleteEntityConfiguration<Model>
    {
        public override void Configure(EntityTypeBuilder<Model> builder)
        {
           
            base.Configure(builder);

            builder.Property(x => x.Name)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.NameAr)
                .IsRequired()
                .HasMaxLength(100);

            builder.Property(x => x.IsActive)
                .HasDefaultValue(true);

            builder.HasIndex(x => new { x.MakeId, x.Name })
                .IsUnique()
                .HasFilter("[IsDeleted] = 0");

            builder.HasIndex(x => new { x.MakeId, x.NameAr })
                .IsUnique()
                .HasFilter("[IsDeleted] = 0");

            builder.HasOne(x => x.Make)
                .WithMany(x => x.Models)
                .HasForeignKey(x => x.MakeId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
