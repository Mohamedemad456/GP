using Microsoft.AspNetCore.Identity;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Identity
{
	public class ApplicationUser : IdentityUser<Guid>
	{
		public bool IsActive { get; set; } = true;
	}
}
