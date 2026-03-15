using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	internal class ConditionChecklistCategoryConfiguration : BaseAuditableEntityConfiguration<ConditionChecklistCategory>
	{
		public override void Configure(EntityTypeBuilder<ConditionChecklistCategory> builder)
		{
			base.Configure(builder);

			builder.Property(c => c.Name)
				.IsRequired()
				.HasMaxLength(100);

			builder.Property(c => c.NameAr)
				.IsRequired()
				.HasMaxLength(100);


			builder.HasIndex(c => c.Name)
				.IsUnique();

			builder.HasIndex(c => c.NameAr)
				.IsUnique();

			builder.Property(c => c.Description)
					.HasMaxLength(500);

			builder.Property(c => c.IsActive)
				.IsRequired()
				.HasDefaultValue(true);

		}
	}
}