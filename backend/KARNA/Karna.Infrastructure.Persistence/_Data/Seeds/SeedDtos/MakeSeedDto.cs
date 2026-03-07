using System;
using System.Collections.Generic;
using System.Text;

namespace Karna.Infrastructure.Persistence._Data.Seeds.SeedDtos
{
	public class MakeSeedDto
	{
		public string Name { get; set; } = default!;
		public string NameAr { get; set; } = default!;
		public string? LogoUrl { get; set; }
		public string? Country { get; set; }
		public string? CountryAr { get; set; }
	}
}
