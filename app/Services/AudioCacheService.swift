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
        let metadataURL = cacheDirectory.appendingPathComponent(fileName + ".meta")

        // Check if already cached and still valid
        if fileManager.fileExists(atPath: localURL.path) {
            // Check if server has newer version using HEAD request
            if let isValid = await validateCache(remoteURL: remoteURL, metadataURL: metadataURL), isValid {
                return localURL
            }
            // Cache invalid, remove old file
            try? fileManager.removeItem(at: localURL)
            try? fileManager.removeItem(at: metadataURL)
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

            // Save metadata (ETag or Last-Modified) for future validation
            saveMetadata(from: httpResponse, to: metadataURL)

            return localURL
        } catch {
            print("Failed to download audio: \(error)")
            return nil
        }
    }

    /// Validate cached file against server using HEAD request
    private func validateCache(remoteURL: URL, metadataURL: URL) async -> Bool? {
        // Read saved metadata
        guard let savedMetadata = try? String(contentsOf: metadataURL, encoding: .utf8) else {
            return false // No metadata, need to redownload
        }

        // Make HEAD request to check if file changed
        var request = URLRequest(url: remoteURL)
        request.httpMethod = "HEAD"

        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else { return false }

            // Check ETag or Last-Modified
            if let etag = httpResponse.value(forHTTPHeaderField: "ETag") {
                return savedMetadata.contains(etag)
            }
            if let lastModified = httpResponse.value(forHTTPHeaderField: "Last-Modified") {
                return savedMetadata.contains(lastModified)
            }

            // No cache headers, assume valid
            return true
        } catch {
            // Network error, use cached version
            return true
        }
    }

    /// Save response metadata for cache validation
    private func saveMetadata(from response: HTTPURLResponse, to url: URL) {
        var metadata = ""
        if let etag = response.value(forHTTPHeaderField: "ETag") {
            metadata += "ETag: \(etag)\n"
        }
        if let lastModified = response.value(forHTTPHeaderField: "Last-Modified") {
            metadata += "Last-Modified: \(lastModified)\n"
        }
        try? metadata.write(to: url, atomically: true, encoding: .utf8)
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
