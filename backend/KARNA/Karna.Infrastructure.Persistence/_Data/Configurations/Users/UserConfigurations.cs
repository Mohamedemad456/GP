using Karna.Core.Domain.Entities;
using Karna.Core.Domain.Enums;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Data.Configurations.Users
{
	public class UserConfigurations : BaseAuditableEntityConfiguration<User>
	{
		public override void Configure(EntityTypeBuilder<User> builder)
		{
			base.Configure(builder);

			builder.HasIndex(u => u.IdentityUserId)
				.IsUnique();

			builder.Property(u => u.Name)
				.IsRequired()
				.HasMaxLength(100);

			builder.Property(u => u.WhatsAppNumber)
				.HasMaxLength(20);

			builder.Property(u => u.PreferredContactMethod)
				.HasConversion<string>()
				.HasMaxLength(20);


			builder.Property(u => u.IsActive)
				.IsRequired()
				.HasDefaultValue(true);
		}
	}
}
