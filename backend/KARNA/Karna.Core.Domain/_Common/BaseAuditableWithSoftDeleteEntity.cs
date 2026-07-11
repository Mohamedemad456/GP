using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Domain._Common
{
	public abstract class BaseAuditableWithSoftDeleteEntity : BaseAuditableEntity, ISoftDelete
	{
		public bool IsDeleted { get; set; }
	}
}
