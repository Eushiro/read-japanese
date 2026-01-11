import SwiftUI

/// Animated book with flipping pages for loading states
struct BookFlipAnimation: View {
    @State private var currentPage = 0
    @Environment(\.colorScheme) private var colorScheme

    private let pageCount = 3
    private let flipDuration: Double = 0.6
    private let delayBetweenFlips: Double = 0.15

    private var bookColor: Color {
        colorScheme == .dark ? Color(white: 0.25) : Color(white: 0.85)
    }

    private var pageColor: Color {
        colorScheme == .dark ? Color(white: 0.35) : Color.white
    }

    private var spineColor: Color {
        colorScheme == .dark ? Color(white: 0.2) : Color(white: 0.7)
    }

    private var accentColor: Color {
        .green.opacity(0.8)
    }

    var body: some View {
        GeometryReader { geometry in
            let size = min(geometry.size.width, geometry.size.height)
            let bookWidth = size * 0.8
            let bookHeight = size
            let pageWidth = bookWidth * 0.45

            ZStack {
                // Book spine/base
                bookBase(width: bookWidth, height: bookHeight)

                // Left side (closed pages)
                leftPages(width: pageWidth, height: bookHeight * 0.9)
                    .offset(x: -pageWidth * 0.5)

                // Right side (closed pages)
                rightPages(width: pageWidth, height: bookHeight * 0.9)
                    .offset(x: pageWidth * 0.5)

                // Flipping pages
                ForEach(0..<pageCount, id: \.self) { index in
                    FlippingPage(
                        width: pageWidth,
                        height: bookHeight * 0.9,
                        pageColor: pageColor,
                        isFlipping: currentPage > index,
                        delay: Double(index) * delayBetweenFlips
                    )
                }
            }
            .frame(width: size, height: size)
            .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
        }
        .onAppear {
            startAnimation()
        }
    }

    private func bookBase(width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            // Book cover background
            RoundedRectangle(cornerRadius: 4)
                .fill(bookColor)
                .frame(width: width, height: height)

            // Spine
            Rectangle()
                .fill(spineColor)
                .frame(width: 4, height: height)

            // Accent stripe on cover
            RoundedRectangle(cornerRadius: 2)
                .fill(accentColor)
                .frame(width: width * 0.15, height: height * 0.6)
                .offset(x: -width * 0.35)
        }
    }

    private func leftPages(width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            ForEach(0..<4, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(pageColor)
                    .frame(width: width - CGFloat(i) * 2, height: height - CGFloat(i) * 2)
                    .shadow(color: .black.opacity(0.05), radius: 1, x: -1, y: 0)
            }
        }
    }

    private func rightPages(width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            ForEach(0..<4, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(pageColor)
                    .frame(width: width - CGFloat(i) * 2, height: height - CGFloat(i) * 2)
                    .shadow(color: .black.opacity(0.05), radius: 1, x: 1, y: 0)
            }
        }
    }

    private func startAnimation() {
        // Reset and start the flip cycle
        currentPage = 0

        // Animate through pages
        for i in 1...pageCount {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * (flipDuration * 0.7)) {
                withAnimation(.easeInOut(duration: flipDuration)) {
                    currentPage = i
                }
            }
        }

        // Reset and repeat
        let totalDuration = Double(pageCount + 1) * flipDuration
        DispatchQueue.main.asyncAfter(deadline: .now() + totalDuration) {
            currentPage = 0
            startAnimation()
        }
    }
}

/// A single page that flips from right to left
struct FlippingPage: View {
    let width: CGFloat
    let height: CGFloat
    let pageColor: Color
    let isFlipping: Bool
    let delay: Double

    @State private var rotation: Double = 0

    var body: some View {
        ZStack {
            // Page front (visible when not flipped)
            RoundedRectangle(cornerRadius: 2)
                .fill(pageColor)
                .frame(width: width, height: height)
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
                .overlay {
                    // Page lines (text simulation)
                    VStack(spacing: 6) {
                        ForEach(0..<5, id: \.self) { _ in
                            RoundedRectangle(cornerRadius: 1)
                                .fill(Color.gray.opacity(0.2))
                                .frame(height: 2)
                                .padding(.horizontal, 8)
                        }
                    }
                    .padding(.vertical, 12)
                }
        }
        .rotation3DEffect(
            .degrees(rotation),
            axis: (x: 0, y: 1, z: 0),
            anchor: .leading,
            perspective: 0.5
        )
        .offset(x: width * 0.5)
        .opacity(rotation > 90 ? 0 : 1)
        .onChange(of: isFlipping) { _, flipping in
            if flipping {
                withAnimation(.easeInOut(duration: 0.5).delay(delay)) {
                    rotation = 180
                }
            } else {
                rotation = 0
            }
        }
    }
}

#Preview {
    VStack(spacing: 40) {
        BookFlipAnimation()
            .frame(width: 80, height: 80)

        BookFlipAnimation()
            .frame(width: 120, height: 120)
    }
    .padding(40)
}
