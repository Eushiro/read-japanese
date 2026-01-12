import AVFoundation
import Combine

/// Service for playing story audio with sentence synchronization
@MainActor
class AudioPlayerService: ObservableObject {
    // MARK: - Published Properties

    /// Whether audio is currently playing
    @Published private(set) var isPlaying = false

    /// Current playback time in seconds
    @Published private(set) var currentTime: Double = 0

    /// Total duration of the audio in seconds
    @Published private(set) var duration: Double = 0

    /// The ID of the currently highlighted segment (based on audio position)
    @Published private(set) var currentSegmentId: String?

    /// Whether audio is loaded and ready to play
    @Published private(set) var isLoaded = false

    /// Loading error if any
    @Published private(set) var loadError: String?

    // MARK: - Private Properties

    private var player: AVPlayer?
    private var playerItem: AVPlayerItem?
    private var timeObserver: Any?
    private var segments: [StorySegment] = []
    private var cancellables = Set<AnyCancellable>()

    // MARK: - Initialization

    init() {
        setupAudioSession()
    }

    // MARK: - Public Methods

    /// Load audio for a story chapter
    /// - Parameters:
    ///   - audioURL: URL of the audio file
    ///   - segments: Segments with timing data for sync
    func loadAudio(from audioURL: URL, segments: [StorySegment]) async {
        cleanup()

        self.segments = segments
        loadError = nil
        isLoaded = false

        do {
            // Try to get cached local URL, download if needed
            let localURL: URL
            if audioURL.isFileURL {
                localURL = audioURL
            } else if let cachedURL = await AudioCacheService.shared.localURL(for: audioURL) {
                localURL = cachedURL
            } else {
                // Fall back to streaming if cache fails
                localURL = audioURL
            }

            let asset = AVURLAsset(url: localURL)
            let duration = try await asset.load(.duration)
            self.duration = CMTimeGetSeconds(duration)

            playerItem = AVPlayerItem(asset: asset)
            player = AVPlayer(playerItem: playerItem)

            setupTimeObserver()
            setupNotifications()

            isLoaded = true
        } catch {
            loadError = "Failed to load audio: \(error.localizedDescription)"
            print("Audio load error: \(error)")
        }
    }

    /// Start or resume playback
    func play() {
        guard isLoaded, let player = player else { return }
        player.play()
        isPlaying = true
    }

    /// Pause playback
    func pause() {
        player?.pause()
        isPlaying = false
    }

    /// Toggle between play and pause
    func togglePlayback() {
        if isPlaying {
            pause()
        } else {
            play()
        }
    }

    /// Seek to a specific time
    /// - Parameter time: Time in seconds
    func seek(to time: Double) {
        guard let player = player else { return }
        let cmTime = CMTime(seconds: time, preferredTimescale: 600)
        player.seek(to: cmTime, toleranceBefore: .zero, toleranceAfter: .zero)
        currentTime = time
        updateCurrentSegment()
    }

    /// Seek to a specific segment
    /// - Parameter segmentId: ID of the segment to seek to
    func seekToSegment(_ segmentId: String) {
        guard let segment = segments.first(where: { $0.id == segmentId }),
              let startTime = segment.audioStartTime else {
            return
        }
        seek(to: startTime)
    }

    /// Skip forward by a number of seconds
    func skipForward(seconds: Double = 10) {
        let newTime = min(currentTime + seconds, duration)
        seek(to: newTime)
    }

    /// Skip backward by a number of seconds
    func skipBackward(seconds: Double = 10) {
        let newTime = max(currentTime - seconds, 0)
        seek(to: newTime)
    }

    /// Stop playback and reset
    func stop() {
        pause()
        seek(to: 0)
        currentSegmentId = nil
    }

    /// Clean up resources
    func cleanup() {
        stop()

        if let observer = timeObserver {
            player?.removeTimeObserver(observer)
            timeObserver = nil
        }

        player = nil
        playerItem = nil
        segments = []
        isLoaded = false
        duration = 0
        currentTime = 0
    }

    // MARK: - Private Methods

    private func setupAudioSession() {
        #if os(iOS)
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to setup audio session: \(error)")
        }
        #endif
    }

    private func setupTimeObserver() {
        guard let player = player else { return }

        // Update current time 10 times per second
        let interval = CMTime(seconds: 0.1, preferredTimescale: 600)
        timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self = self else { return }
            let seconds = CMTimeGetSeconds(time)
            Task { @MainActor [weak self] in
                self?.currentTime = seconds
                self?.updateCurrentSegment()
            }
        }
    }

    private func setupNotifications() {
        NotificationCenter.default.publisher(for: .AVPlayerItemDidPlayToEndTime)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in
                self?.isPlaying = false
                self?.currentTime = 0
                self?.currentSegmentId = nil
            }
            .store(in: &cancellables)
    }

    private func updateCurrentSegment() {
        // Find the segment that contains the current playback time
        let newSegmentId = segments.first { segment in
            guard let start = segment.audioStartTime,
                  let end = segment.audioEndTime else {
                return false
            }
            return currentTime >= start && currentTime < end
        }?.id

        if newSegmentId != currentSegmentId {
            currentSegmentId = newSegmentId
        }
    }
}

// MARK: - Playback Rate

extension AudioPlayerService {
    /// Current playback rate
    var playbackRate: Float {
        player?.rate ?? 1.0
    }

    /// Set playback rate (0.5 = half speed, 1.0 = normal, 2.0 = double)
    func setPlaybackRate(_ rate: Float) {
        player?.rate = rate
    }
}
