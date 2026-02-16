using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Persistence._Data.Configurations.Base;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Karna.Infrastructure.Persistence._Data.Configurations
{
	public class RefreshTokenConfiguration : BaseEntityConfiguration<RefreshToken>
	{
		public override void Configure(EntityTypeBuilder<RefreshToken> builder)
		{
			base.Configure(builder);

			builder.Property(rt => rt.TokenHashed)
				.IsRequired()
				.HasMaxLength(256);

			builder.Property(rt => rt.DeviceInfo)
				.HasMaxLength(512);

			builder.HasIndex(rt => rt.IdentityUserId);
			builder.HasIndex(rt => rt.TokenHashed);
		}
	}
}