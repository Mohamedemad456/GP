namespace Karna.Core.Application.Abstraction.DTOs.Listing
{
	public class ListingPhotoDto
	{
		public Guid Id { get; set; }
		public string PhotoUrl { get; set; } = string.Empty;
		public bool IsPrimary { get; set; }
		public int DisplayOrder { get; set; }
	}
}
