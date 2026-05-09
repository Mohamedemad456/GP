using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	internal class ListingConfiguration : SoftDeleteEntityConfiguration<Listing>
	{
		public override void Configure(EntityTypeBuilder<Listing> builder)
		{
			base.Configure(builder);

			builder.Property(x => x.SellerId).IsRequired();
			builder.Property(x => x.MakeId).IsRequired();
			builder.Property(x => x.ModelId).IsRequired();

			builder.Property(x => x.Year).IsRequired();
			builder.Property(x => x.Mileage).IsRequired();

			builder.Property(x => x.EngineSize)
				.IsRequired()
				.HasPrecision(4, 1);

			builder.Property(x => x.Color)
				.IsRequired()
				.HasMaxLength(50);

			builder.Property(x => x.Description)
				.IsRequired()
				.HasMaxLength(2000);

			builder.Property(x => x.Status)
				.IsRequired()
				.HasConversion<string>()
				.HasMaxLength(20);

			builder.Property(x => x.FuelType)
				.IsRequired()
				.HasConversion<string>()
				.HasMaxLength(20);

			builder.Property(x => x.Transmission)
				.IsRequired()
				.HasConversion<string>()
				.HasMaxLength(20);

            builder.Property(e => e.DeletedAt)
                .IsRequired(false);

            builder.HasIndex(x => x.MakeId);
			builder.HasIndex(x => x.ModelId);
			builder.HasIndex(x => x.SellerId);

			builder.HasOne(x => x.Seller)
				.WithMany()
				.HasForeignKey(x => x.SellerId)
				.OnDelete(DeleteBehavior.Restrict);

			builder.HasOne(x => x.Make)
				.WithMany()
				.HasForeignKey(x => x.MakeId)
				.OnDelete(DeleteBehavior.Restrict);

			builder.HasOne(x => x.Model)
				.WithMany()
				.HasForeignKey(x => x.ModelId)
				.OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(x => x.StatusHistories)
				.WithOne(h => h.Listing)
				.HasForeignKey(h => h.ListingId);

			builder.HasOne(x => x.ApprovedByAdmin)
				.WithMany()
				.HasForeignKey(x => x.ApprovedByAdminId)
				.OnDelete(DeleteBehavior.Restrict)
				.IsRequired(false);

			builder.Property(x => x.ApprovedAt)
				.IsRequired(false);

			builder.Property(x => x.RejectionReason)
				.IsRequired(false)
				.HasMaxLength(500);

			builder.Property(x => x.Location);

			builder.Property(x => x.Price)
				.HasPrecision(18, 2);

			// ML Pricing Fields
			builder.Property(x => x.FairPrice)
				.HasPrecision(18, 2);

			builder.Property(x => x.NegotiationRangeLower)
				.HasPrecision(18, 2);

			builder.Property(x => x.NegotiationRangeUpper)
				.HasPrecision(18, 2);

			builder.Property(x => x.ConfidenceLevel)
				.HasMaxLength(20);

			builder.Property(x => x.ModelVersion)
				.HasMaxLength(50);

			builder.Property(x => x.PredictedAt);
		}
	}
}