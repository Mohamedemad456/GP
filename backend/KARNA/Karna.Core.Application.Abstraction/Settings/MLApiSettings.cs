namespace Karna.Core.Application.Abstraction.Settings
{
	public class MLApiSettings
	{
		public string BaseUrl { get; set; } = string.Empty;
		public int TimeoutSeconds { get; set; } = 30;
	}
}
