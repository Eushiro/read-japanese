import Foundation

/// API Configuration for different environments
enum APIConfig {
    // MARK: - Production URL
    // TODO: Update this with your Render URL after deployment
    // Format: https://your-app-name.onrender.com
    private static let productionURL = "https://japanese-reader-api.onrender.com"

    /// Base URL for the API
    /// - In DEBUG builds: Uses localhost for simulator development
    /// - In RELEASE builds: Uses the production server URL
    static var baseURL: String {
        #if DEBUG
        // Development - for simulator use
        // Change this to your local IP if testing on a physical device
        // Example for physical device: "http://192.168.1.100:8000"
        return "http://localhost:8000"
        #else
        return productionURL
        #endif
    }

    /// Request timeout interval in seconds
    static let timeout: TimeInterval = 30

    /// Configured URLSession with appropriate timeout and caching
    static var session: URLSession {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = timeout
        config.timeoutIntervalForResource = timeout * 2
        // Enable URL caching for better offline support
        config.requestCachePolicy = .returnCacheDataElseLoad
        config.urlCache = URLCache(
            memoryCapacity: 50_000_000,  // 50 MB memory cache
            diskCapacity: 100_000_000     // 100 MB disk cache
        )
        return URLSession(configuration: config)
    }
}
