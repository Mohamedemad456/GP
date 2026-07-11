namespace Karna.Core.Application.Abstraction.DTOs.Lookup
{
	public class LookupOptionDto
	{
		public int Value { get; set; }
		public string Label { get; set; } = string.Empty;
	}

	public class LookupGroupDto
	{
		public string Name { get; set; } = string.Empty;
		public IEnumerable<LookupOptionDto> Options { get; set; } = [];
	}
}
