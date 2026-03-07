using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	internal class MakeConfiguration : SoftDeleteEntityConfiguration<Make>
	{
		public override void Configure(EntityTypeBuilder<Make> builder)
		{
			base.Configure(builder);

			builder.Property(m => m.Name)
				.IsRequired()
				.HasMaxLength(100);

			builder.HasIndex(m => m.Name)
				.IsUnique()
				.HasFilter("[IsDeleted] = 0");

			builder.Property(m => m.NameAr)
				.IsRequired()
				.HasMaxLength(100);

			builder.HasIndex(m => m.NameAr)
				.IsUnique()
				.HasFilter("[IsDeleted] = 0");

			builder.Property(m => m.LogoUrl)
				.HasMaxLength(500);

			builder.Property(m => m.Country)
				.HasMaxLength(100);

			builder.Property(m => m.CountryAr)
				.HasMaxLength(100);
		}
	}
}