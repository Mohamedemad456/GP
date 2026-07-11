using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Domain._Common
{
	public abstract class BaseAuditableEntity : BaseEntity
	{
		public DateTime CreatedAt { get; protected set; }
		public DateTime? UpdatedAt { get; protected set; }
	}
}
