import SwiftUI

#if canImport(UIKit)
import UIKit

/// A scroll view that supports smooth auto-scrolling triggered by long press
struct AutoScrollView<Content: View>: UIViewRepresentable {
    let content: Content
    @Binding var isAutoScrolling: Bool
    @Binding var scrollOffset: CGFloat
    let scrollSpeed: CGFloat // Points per second

    init(
        isAutoScrolling: Binding<Bool>,
        scrollOffset: Binding<CGFloat> = .constant(0),
        scrollSpeed: CGFloat,
        @ViewBuilder content: () -> Content
    ) {
        self._isAutoScrolling = isAutoScrolling
        self._scrollOffset = scrollOffset
        self.scrollSpeed = scrollSpeed
        self.content = content()
    }

    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.delegate = context.coordinator
        scrollView.showsVerticalScrollIndicator = true
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.alwaysBounceVertical = true

        let hostingController = UIHostingController(rootView: content)
        hostingController.view.backgroundColor = .clear
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false

        scrollView.addSubview(hostingController.view)
        context.coordinator.hostingController = hostingController
        context.coordinator.scrollView = scrollView

        NSLayoutConstraint.activate([
            hostingController.view.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor),
            hostingController.view.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor),
            hostingController.view.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor)
        ])

        // Add long press gesture for hold-to-scroll
        let longPressGesture = UILongPressGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleLongPress(_:))
        )
        longPressGesture.minimumPressDuration = 0.3
        scrollView.addGestureRecognizer(longPressGesture)

        return scrollView
    }

    func updateUIView(_ scrollView: UIScrollView, context: Context) {
        // Update content
        context.coordinator.hostingController?.rootView = content

        // Force layout update to recalculate content size
        context.coordinator.hostingController?.view.invalidateIntrinsicContentSize()
        context.coordinator.hostingController?.view.setNeedsLayout()
        context.coordinator.hostingController?.view.layoutIfNeeded()

        // Update scroll speed
        context.coordinator.currentSpeed = scrollSpeed

        // Sync auto-scrolling state (for external control)
        if isAutoScrolling && !context.coordinator.isScrolling {
            context.coordinator.startAutoScroll()
        } else if !isAutoScrolling && context.coordinator.isScrolling {
            context.coordinator.stopAutoScroll()
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    class Coordinator: NSObject, UIScrollViewDelegate {
        var parent: AutoScrollView
        var hostingController: UIHostingController<Content>?
        weak var scrollView: UIScrollView?
        private var displayLink: CADisplayLink?
        private var lastTimestamp: CFTimeInterval = 0
        var currentSpeed: CGFloat = 50
        var isScrolling: Bool = false

        init(parent: AutoScrollView) {
            self.parent = parent
            self.currentSpeed = parent.scrollSpeed
        }

        @objc func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
            switch gesture.state {
            case .began:
                startAutoScroll()
                DispatchQueue.main.async {
                    self.parent.isAutoScrolling = true
                }
            case .ended, .cancelled, .failed:
                stopAutoScroll()
                DispatchQueue.main.async {
                    self.parent.isAutoScrolling = false
                }
            default:
                break
            }
        }

        func startAutoScroll() {
            guard !isScrolling, scrollView != nil else { return }
            isScrolling = true

            lastTimestamp = 0
            displayLink = CADisplayLink(target: self, selector: #selector(handleDisplayLink(_:)))
            displayLink?.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
            displayLink?.add(to: .main, forMode: .common)
        }

        func stopAutoScroll() {
            isScrolling = false
            displayLink?.invalidate()
            displayLink = nil
            lastTimestamp = 0
        }

        @objc private func handleDisplayLink(_ displayLink: CADisplayLink) {
            guard let scrollView = scrollView else { return }

            if lastTimestamp == 0 {
                lastTimestamp = displayLink.timestamp
                return
            }

            let deltaTime = displayLink.timestamp - lastTimestamp
            lastTimestamp = displayLink.timestamp

            // Calculate scroll delta based on current speed (points per second)
            let scrollDelta = currentSpeed * CGFloat(deltaTime)

            // Calculate new offset
            var newOffset = scrollView.contentOffset
            newOffset.y += scrollDelta

            // Check if we've reached the bottom
            let maxOffset = max(0, scrollView.contentSize.height - scrollView.bounds.height + scrollView.contentInset.bottom)
            if newOffset.y >= maxOffset {
                newOffset.y = maxOffset
                // Stop auto-scrolling when reaching the end
                stopAutoScroll()
                DispatchQueue.main.async {
                    self.parent.isAutoScrolling = false
                }
                return
            }

            // Apply the new offset
            if newOffset.y >= 0 {
                scrollView.contentOffset = newOffset
            }
        }

        // UIScrollViewDelegate - stop auto-scroll on manual drag
        func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
            if isScrolling {
                stopAutoScroll()
                DispatchQueue.main.async {
                    self.parent.isAutoScrolling = false
                }
            }
        }

        // UIScrollViewDelegate - report scroll offset
        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            DispatchQueue.main.async {
                self.parent.scrollOffset = max(0, scrollView.contentOffset.y)
            }
        }
    }
}

#else
// Fallback for non-iOS platforms (macOS, etc.)
struct AutoScrollView<Content: View>: View {
    let content: Content
    @Binding var isAutoScrolling: Bool
    @Binding var scrollOffset: CGFloat
    let scrollSpeed: CGFloat

    init(
        isAutoScrolling: Binding<Bool>,
        scrollOffset: Binding<CGFloat> = .constant(0),
        scrollSpeed: CGFloat,
        @ViewBuilder content: () -> Content
    ) {
        self._isAutoScrolling = isAutoScrolling
        self._scrollOffset = scrollOffset
        self.scrollSpeed = scrollSpeed
        self.content = content()
    }

    var body: some View {
        ScrollView(.vertical, showsIndicators: true) {
            content
        }
    }
}
#endif

// MARK: - Preview

#Preview {
    struct PreviewWrapper: View {
        @State private var isAutoScrolling = false

        var body: some View {
            VStack {
                Text(isAutoScrolling ? "Hold to scroll (scrolling...)" : "Long press to auto-scroll")
                    .padding()
                    .background(isAutoScrolling ? Color.blue.opacity(0.2) : Color.gray.opacity(0.1))
                    .cornerRadius(8)

                AutoScrollView(isAutoScrolling: $isAutoScrolling, scrollSpeed: 300) {
                    VStack(spacing: 20) {
                        ForEach(0..<50, id: \.self) { i in
                            Text("Line \(i)")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.gray.opacity(0.1))
                        }
                    }
                    .padding()
                }
            }
        }
    }

    return PreviewWrapper()
}
