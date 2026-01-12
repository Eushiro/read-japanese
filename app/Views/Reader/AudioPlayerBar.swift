import SwiftUI

/// Compact audio player bar for story playback
struct AudioPlayerBar: View {
    @ObservedObject var audioPlayer: AudioPlayerService
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        VStack(spacing: 8) {
            // Progress bar
            ProgressView(value: audioPlayer.currentTime, total: max(audioPlayer.duration, 1))
                .tint(.blue)

            HStack(spacing: 20) {
                // Time display
                Text(formatTime(audioPlayer.currentTime))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                    .frame(width: 45, alignment: .leading)

                Spacer()

                // Skip backward
                Button {
                    audioPlayer.skipBackward(seconds: 5)
                } label: {
                    Image(systemName: "gobackward.5")
                        .font(.title3)
                }
                .foregroundStyle(.primary)

                // Play/Pause button
                Button {
                    audioPlayer.togglePlayback()
                } label: {
                    Image(systemName: audioPlayer.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                        .font(.system(size: 44))
                }
                .foregroundStyle(.blue)

                // Skip forward
                Button {
                    audioPlayer.skipForward(seconds: 5)
                } label: {
                    Image(systemName: "goforward.5")
                        .font(.title3)
                }
                .foregroundStyle(.primary)

                Spacer()

                // Duration display
                Text(formatTime(audioPlayer.duration))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
                    .frame(width: 45, alignment: .trailing)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(.secondarySystemBackground))
    }

    private func formatTime(_ seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}

/// Mini audio player button for the toolbar
struct AudioPlayerButton: View {
    @ObservedObject var audioPlayer: AudioPlayerService
    let hasAudio: Bool
    @Binding var showAudioPlayer: Bool

    var body: some View {
        if hasAudio {
            Button {
                showAudioPlayer.toggle()
            } label: {
                Image(systemName: audioPlayer.isPlaying ? "waveform" : "speaker.wave.2")
                    .font(.title2)
                    .symbolEffect(.variableColor, isActive: audioPlayer.isPlaying)
            }
            .foregroundStyle(audioPlayer.isPlaying ? .blue : .primary)
        }
    }
}

#Preview {
    VStack {
        Spacer()
        AudioPlayerBar(audioPlayer: AudioPlayerService())
    }
}
