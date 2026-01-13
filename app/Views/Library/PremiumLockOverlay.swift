import SwiftUI

/// Overlay shown on premium story cards for non-premium users
struct PremiumLockOverlay: View {
    var body: some View {
        ZStack {
            // Semi-transparent background
            Color.black.opacity(0.4)

            // Lock icon with badge
            VStack(spacing: 4) {
                Image(systemName: "lock.fill")
                    .font(.title2)
                    .foregroundStyle(.white)

                Text("Premium")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
            }
            .padding(8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.black.opacity(0.6))
            )
        }
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

#Preview {
    PremiumLockOverlay()
        .frame(width: 85, height: 106)
}
