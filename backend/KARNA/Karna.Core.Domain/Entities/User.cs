using Karna.Core.Domain._Common;
using Karna.Core.Domain.Enums;
using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Domain.Entities
{
	public class User : BaseAuditableEntity
	{
		public Guid IdentityUserId { get; set; }
		public required string Name { get; set; }

		public string? WhatsAppNumber { get; set; }

		public ContactMethod PreferredContactMethod { get; set; } = ContactMethod.Phone;
		public bool IsActive { get; set; } = true;
	}
}
