using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Core.Application.Abstraction.External
{
	public interface ICurrentUserService
	{
		Guid UserId { get; }
		string? UserName { get; }
		string? Email { get; }
		bool IsAuthenticated { get; }
		IEnumerable<string> Roles { get; }
		bool IsInRole(string role);
	}
}
