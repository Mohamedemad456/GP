using Karna.Core.Application.Abstraction.Initializers;
using Karna.Infrastructure.Persistence._Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Initializers
{
	internal sealed class AppIdentityDbInitializer(AppIdentityDbContext _identityDbContext) : DbInitializer(_identityDbContext), IAppIdentityDbInitializer
	{
		public override async Task SeedDbAsync()
		{
			// TODO: Add seed data here
		}
	}
}
