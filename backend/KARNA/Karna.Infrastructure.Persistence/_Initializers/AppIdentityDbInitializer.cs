using Karna.Core.Application.Abstraction.Initializers;
using Karna.Core.Domain.Entities;
using Karna.Infrastructure.Identity;
using Karna.Infrastructure.Persistence._Data;
using Karna.Infrastructure.Persistence._Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Initializers
{
	internal sealed class AppIdentityDbInitializer(
		AppIdentityDbContext _identityDbContext,
		AppDbContext _appDbContext,
		RoleManager<IdentityRole<Guid>> _roleManager,
		UserManager<ApplicationUser> _userManager
	) : DbInitializer(_identityDbContext), IAppIdentityDbInitializer
	{
		public override async Task SeedDbAsync()
		{
			await SeedRolesAsync();
			await SeedAdminUserAsync();
		}

		private async Task SeedRolesAsync()
		{
			string[] roleNames = { "Admin", "User" };

			foreach (var role in roleNames)
			{
				if (!await _roleManager.RoleExistsAsync(role))
				{
					await _roleManager.CreateAsync(new IdentityRole<Guid>(role));
				}
			}
		}

		private async Task SeedAdminUserAsync()
		{
			var adminEmail = "admin@karna.com";

			var existingUser = await _userManager.FindByEmailAsync(adminEmail);

			if (existingUser is null)
			{
				existingUser = new ApplicationUser
				{
					Id = Guid.NewGuid(),
					UserName = "admin",
					Email = adminEmail,
					EmailConfirmed = true,
					IsActive = true
				};

				var result = await _userManager.CreateAsync(existingUser, "Karna@123");

				if (result.Succeeded)
				{
					await _userManager.AddToRoleAsync(existingUser, "Admin");
				}
			}

			if (!await _appDbContext.Users.AnyAsync(u => u.IdentityUserId == existingUser.Id))
			{
				await _appDbContext.Users.AddAsync(new User
				{
					IdentityUserId = existingUser.Id,
					Name = "System Admin"
				});
				await _appDbContext.SaveChangesAsync();
			}
		}
	}
}
