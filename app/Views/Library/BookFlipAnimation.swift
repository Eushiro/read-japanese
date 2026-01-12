import SwiftUI

/// Animated open book with flipping pages for loading states
struct BookFlipAnimation: View {
    @State private var currentPage = 0
    @State private var isAnimating = false
    @Environment(\.colorScheme) private var colorScheme

    private let pageCount = 4
    private let flipDuration: Double = 0.5

    private var pageColor: Color {
        colorScheme == .dark ? Color(white: 0.9) : Color.white
    }

    private var pageShadowColor: Color {
        colorScheme == .dark ? Color.black.opacity(0.3) : Color.black.opacity(0.1)
    }

    private var spineColor: Color {
        colorScheme == .dark ? Color(white: 0.3) : Color(white: 0.85)
    }

    private var lineColor: Color {
        colorScheme == .dark ? Color(white: 0.6) : Color(white: 0.75)
    }

    var body: some View {
        GeometryReader { geometry in
            let size = min(geometry.size.width, geometry.size.height)
            let pageWidth = size * 0.42
            let pageHeight = size * 0.7

            ZStack {
                // Book spine (center)
                Rectangle()
                    .fill(spineColor)
                    .frame(width: 6, height: pageHeight + 8)
                    .shadow(color: pageShadowColor, radius: 2, x: 0, y: 2)

                // Left page stack (already read pages)
                leftPageStack(width: pageWidth, height: pageHeight)
                    .offset(x: -pageWidth / 2 - 3)

                // Right page stack (pages to read)
                rightPageStack(width: pageWidth, height: pageHeight)
                    .offset(x: pageWidth / 2 + 3)

                // Flipping pages
                ForEach(0..<pageCount, id: \.self) { index in
                    OpenBookFlippingPage(
                        width: pageWidth,
                        height: pageHeight,
                        pageColor: pageColor,
                        lineColor: lineColor,
                        shadowColor: pageShadowColor,
                        isFlipping: currentPage > index,
                        pageIndex: index
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

    private func leftPageStack(width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            // Stack of pages on the left (already flipped)
            ForEach(0..<3, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(pageColor)
                    .frame(width: width - CGFloat(i) * 3, height: height - CGFloat(i) * 2)
                    .offset(x: -CGFloat(i) * 1.5, y: CGFloat(i) * 1)
                    .shadow(color: pageShadowColor, radius: 1, x: -1, y: 1)
            }

            // Text lines on top page
            pageLines(width: width, height: height)
        }
    }

    private func rightPageStack(width: CGFloat, height: CGFloat) -> some View {
        ZStack {
            // Stack of pages on the right (to be read)
            ForEach(0..<3, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(pageColor)
                    .frame(width: width - CGFloat(i) * 3, height: height - CGFloat(i) * 2)
                    .offset(x: CGFloat(i) * 1.5, y: CGFloat(i) * 1)
                    .shadow(color: pageShadowColor, radius: 1, x: 1, y: 1)
            }

            // Text lines on top page
            pageLines(width: width, height: height)
        }
    }

    private func pageLines(width: CGFloat, height: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: height * 0.08) {
            ForEach(0..<6, id: \.self) { i in
                RoundedRectangle(cornerRadius: 1)
                    .fill(lineColor)
                    .frame(width: width * (i == 5 ? 0.5 : 0.75), height: 2)
            }
        }
        .frame(width: width * 0.8, alignment: .leading)
    }

    private func startAnimation() {
        guard !isAnimating else { return }
        isAnimating = true
        currentPage = 0

        // Animate through pages with staggered timing
        for i in 1...pageCount {
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(i) * flipDuration * 0.8) {
                withAnimation(.easeInOut(duration: flipDuration)) {
                    currentPage = i
                }
            }
        }

        // Reset and repeat
        let totalDuration = Double(pageCount + 2) * flipDuration
        DispatchQueue.main.asyncAfter(deadline: .now() + totalDuration) {
            isAnimating = false
            currentPage = 0
            startAnimation()
        }
    }
}

/// A single page that flips from right to left in an open book
struct OpenBookFlippingPage: View {
    let width: CGFloat
    let height: CGFloat
    let pageColor: Color
    let lineColor: Color
    let shadowColor: Color
    let isFlipping: Bool
    let pageIndex: Int

    @State private var rotation: Double = 0

    var body: some View {
        ZStack {
            // Page with text lines
            RoundedRectangle(cornerRadius: 2)
                .fill(pageColor)
                .frame(width: width, height: height)
                .shadow(color: shadowColor, radius: 3, x: rotation > 90 ? -2 : 2, y: 2)
                .overlay {
                    // Text simulation
                    VStack(alignment: .leading, spacing: height * 0.08) {
                        ForEach(0..<6, id: \.self) { i in
                            RoundedRectangle(cornerRadius: 1)
                                .fill(lineColor)
                                .frame(width: width * (i == 5 ? 0.5 : 0.75), height: 2)
                        }
                    }
                    .frame(width: width * 0.8, alignment: .leading)
                    .opacity(rotation > 90 ? 0 : 1)
                }
        }
        .rotation3DEffect(
            .degrees(rotation),
            axis: (x: 0, y: 1, z: 0),
            anchor: .leading,
            perspective: 0.4
        )
        .offset(x: width / 2 + 3)
        .zIndex(Double(10 - pageIndex) + (rotation > 90 ? -20 : 0))
        .onChange(of: isFlipping) { _, flipping in
            if flipping {
                withAnimation(.easeInOut(duration: 0.5)) {
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
