using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Domain._Common
{
	public abstract class SoftDeleteEntity : BaseAuditableEntity
	{
		public bool IsDeleted { get; set; }
	}
}
