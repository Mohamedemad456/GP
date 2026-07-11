using Karna.Core.Application.Abstraction.DTOs.Admin;
using Karna.Core.Domain.Entities;

namespace Karna.Core.Application.Mapping
{
	internal static class AdminActivityLogMappingExtensions
	{
		public static AdminActivityLogDto ToDto(this AdminActivityLog source) => new()
		{
			Id = source.Id,
			AdminId = source.AdminId,
			AdminName = source.Admin?.Name ?? string.Empty,
			Action = source.Action,
			EntityType = source.EntityType,
			EntityId = source.EntityId,
			Details = source.Details,
			PerformedAt = source.PerformedAt
		};

		public static IEnumerable<AdminActivityLogDto> ToDto(this IEnumerable<AdminActivityLog> source)
			=> source.Select(x => x.ToDto());
	}
}
