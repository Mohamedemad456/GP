using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.DTOs.Identity
{
	public class UserIdentityDto
	{
		public Guid UserId { get; set; }
		public required string Email { get; set; }

		public required string PhoneNumber { get; set; }
		public required string UserName { get; set; }
		public bool IsActive { get; set; }
		public bool Found { get; set; }
	}
}
