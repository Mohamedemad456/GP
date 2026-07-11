using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Domain._Common
{
	public abstract class BaseEntity
	{
		public Guid Id { get; protected set; } = Guid.NewGuid();
	}
}
