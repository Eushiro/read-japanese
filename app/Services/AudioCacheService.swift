import Foundation

/// Service for caching audio files to disk
actor AudioCacheService {
    static let shared = AudioCacheService()

    private let fileManager = FileManager.default
    private let cacheDirectory: URL

    private init() {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        cacheDirectory = caches.appendingPathComponent("AudioCache", isDirectory: true)

        // Create cache directory if needed
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }

    /// Get local URL for an audio file, downloading if needed
    /// - Parameter remoteURL: The remote URL of the audio file
    /// - Returns: Local file URL if cached or downloaded successfully, nil otherwise
    func localURL(for remoteURL: URL) async -> URL? {
        let fileName = remoteURL.lastPathComponent
        let localURL = cacheDirectory.appendingPathComponent(fileName)

        // Check if already cached
        if fileManager.fileExists(atPath: localURL.path) {
            return localURL
        }

        // Download the file
        do {
            let (tempURL, response) = try await URLSession.shared.download(from: remoteURL)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return nil
            }

            // Move to cache directory
            try? fileManager.removeItem(at: localURL) // Remove if exists
            try fileManager.moveItem(at: tempURL, to: localURL)

            return localURL
        } catch {
            print("Failed to download audio: \(error)")
            return nil
        }
    }

    /// Check if an audio file is cached
    func isCached(remoteURL: URL) -> Bool {
        let fileName = remoteURL.lastPathComponent
        let localURL = cacheDirectory.appendingPathComponent(fileName)
        return fileManager.fileExists(atPath: localURL.path)
    }

    /// Clear all cached audio files
    func clearCache() {
        try? fileManager.removeItem(at: cacheDirectory)
        try? fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    }

    /// Get total size of cached audio files
    func cacheSize() -> Int64 {
        guard let files = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: [.fileSizeKey]) else {
            return 0
        }

        return files.reduce(0) { total, url in
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
            return total + Int64(size)
        }
    }
}
