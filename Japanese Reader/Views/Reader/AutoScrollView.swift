import SwiftUI

#if canImport(UIKit)
import UIKit

/// A scroll view that supports smooth auto-scrolling triggered by long press
struct AutoScrollView<Content: View>: UIViewRepresentable {
    let content: Content
    @Binding var isAutoScrolling: Bool
    @Binding var scrollOffset: CGFloat
    @Binding var scrollToOffset: CGFloat?  // Programmatic scroll target
    @Binding var scrollToIdentifier: String?  // Scroll to view with this accessibility identifier
    let scrollSpeed: CGFloat // Points per second

    init(
        isAutoScrolling: Binding<Bool>,
        scrollOffset: Binding<CGFloat> = .constant(0),
        scrollToOffset: Binding<CGFloat?> = .constant(nil),
        scrollToIdentifier: Binding<String?> = .constant(nil),
        scrollSpeed: CGFloat,
        @ViewBuilder content: () -> Content
    ) {
        self._isAutoScrolling = isAutoScrolling
        self._scrollOffset = scrollOffset
        self._scrollToOffset = scrollToOffset
        self._scrollToIdentifier = scrollToIdentifier
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

        // Handle external scroll offset reset (e.g., when changing chapters)
        if scrollOffset == 0 && scrollView.contentOffset.y > 0 {
            // Only reset if we're not currently being dragged
            if !scrollView.isDragging && !scrollView.isDecelerating {
                scrollView.setContentOffset(.zero, animated: false)
            }
        }

        // Handle programmatic scroll to offset
        if let targetOffset = scrollToOffset {
            let clampedOffset = min(targetOffset, max(0, scrollView.contentSize.height - scrollView.bounds.height))
            scrollView.setContentOffset(CGPoint(x: 0, y: clampedOffset), animated: true)
            // Clear the target after scrolling
            DispatchQueue.main.async {
                self.scrollToOffset = nil
            }
        }

        // Handle scroll to view with accessibility identifier
        if let identifier = scrollToIdentifier {
            // Find view with matching accessibility identifier in the hosting controller's view hierarchy
            if let hostingView = context.coordinator.hostingController?.view {
                if let targetView = findView(withAccessibilityIdentifier: identifier, in: hostingView) {
                    // Convert the target view's frame to scroll view coordinates
                    let frameInScrollView = targetView.convert(targetView.bounds, to: scrollView)
                    let targetOffset = max(0, frameInScrollView.origin.y)
                    let clampedOffset = min(targetOffset, max(0, scrollView.contentSize.height - scrollView.bounds.height))
                    scrollView.setContentOffset(CGPoint(x: 0, y: clampedOffset), animated: true)
                }
            }
            // Clear the target after scrolling
            DispatchQueue.main.async {
                self.scrollToIdentifier = nil
            }
        }

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

    /// Recursively find a view with the specified accessibility identifier in the view hierarchy
    private func findView(withAccessibilityIdentifier identifier: String, in view: UIView) -> UIView? {
        if view.accessibilityIdentifier == identifier {
            return view
        }
        for subview in view.subviews {
            if let found = findView(withAccessibilityIdentifier: identifier, in: subview) {
                return found
            }
        }
        return nil
    }

    class Coordinator: NSObject, UIScrollViewDelegate {
        var parent: AutoScrollView
        var hostingController: UIHostingController<Content>?
        weak var scrollView: UIScrollView?
        private var displayLink: CADisplayLink?
        private var lastTimestamp: CFTimeInterval = 0
        var currentSpeed: CGFloat = 50
        var isScrolling: Bool = false
        private var isProgrammaticScroll: Bool = false  // Track if we're scrolling programmatically
        private var longPressActive: Bool = false  // Track if long press is still held
        private var lastReportedOffset: CGFloat = 0  // Track last reported offset to avoid excessive updates
        private var offsetUpdateWorkItem: DispatchWorkItem?  // Debounce offset updates

        init(parent: AutoScrollView) {
            self.parent = parent
            self.currentSpeed = parent.scrollSpeed
        }

        @objc func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
            switch gesture.state {
            case .began:
                longPressActive = true
                startAutoScroll()
                DispatchQueue.main.async {
                    self.parent.isAutoScrolling = true
                }
            case .ended, .cancelled, .failed:
                longPressActive = false
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
            isProgrammaticScroll = true

            lastTimestamp = 0
            displayLink = CADisplayLink(target: self, selector: #selector(handleDisplayLink(_:)))
            displayLink?.preferredFrameRateRange = CAFrameRateRange(minimum: 30, maximum: 60, preferred: 60)
            displayLink?.add(to: .main, forMode: .common)
        }

        func stopAutoScroll() {
            isScrolling = false
            isProgrammaticScroll = false
            displayLink?.invalidate()
            displayLink = nil
            lastTimestamp = 0
        }

        @objc private func handleDisplayLink(_ displayLink: CADisplayLink) {
            guard let scrollView = scrollView else {
                stopAutoScroll()
                return
            }

            // Stop if long press is no longer active
            if !longPressActive {
                stopAutoScroll()
                DispatchQueue.main.async {
                    self.parent.isAutoScrolling = false
                }
                return
            }

            if lastTimestamp == 0 {
                lastTimestamp = displayLink.timestamp
                return
            }

            let deltaTime = displayLink.timestamp - lastTimestamp
            lastTimestamp = displayLink.timestamp

            // Skip if delta time is too large (app was in background or similar)
            if deltaTime > 0.5 {
                lastTimestamp = displayLink.timestamp
                return
            }

            // Calculate scroll delta based on current speed (points per second)
            let scrollDelta = currentSpeed * CGFloat(deltaTime)

            // Calculate new offset
            var newOffset = scrollView.contentOffset
            newOffset.y += scrollDelta

            // Check if we've reached the bottom
            let maxOffset = max(0, scrollView.contentSize.height - scrollView.bounds.height + scrollView.contentInset.bottom)
            if newOffset.y >= maxOffset {
                newOffset.y = maxOffset
                scrollView.contentOffset = newOffset
                // Stop auto-scrolling when reaching the end
                stopAutoScroll()
                DispatchQueue.main.async {
                    self.parent.isAutoScrolling = false
                }
                return
            }

            // Apply the new offset
            if newOffset.y >= 0 {
                isProgrammaticScroll = true
                scrollView.contentOffset = newOffset
            }
        }

        // UIScrollViewDelegate - stop auto-scroll on manual drag (but not programmatic scroll)
        func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
            // Only stop if this is a real user drag, not our programmatic scrolling
            if isScrolling && !isProgrammaticScroll {
                longPressActive = false
                stopAutoScroll()
                DispatchQueue.main.async {
                    self.parent.isAutoScrolling = false
                }
            }
            // Reset flag after check
            isProgrammaticScroll = false
        }

        // UIScrollViewDelegate - report scroll offset (throttled to avoid feedback loops)
        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            let currentOffset = max(0, scrollView.contentOffset.y)

            // Only update if the change is significant (more than 2 points)
            // This prevents feedback loops with header collapse animations
            let delta = abs(currentOffset - lastReportedOffset)
            guard delta > 2 else { return }

            // Cancel any pending update
            offsetUpdateWorkItem?.cancel()

            // Debounce updates to reduce SwiftUI view update frequency
            let workItem = DispatchWorkItem { [weak self] in
                guard let self = self else { return }
                self.lastReportedOffset = currentOffset
                self.parent.scrollOffset = currentOffset
            }
            offsetUpdateWorkItem = workItem

            // Execute after a tiny delay to batch rapid updates
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.016, execute: workItem)
        }
    }
}

#else
// Fallback for non-iOS platforms (macOS, etc.)
struct AutoScrollView<Content: View>: View {
    let content: Content
    @Binding var isAutoScrolling: Bool
    @Binding var scrollOffset: CGFloat
    @Binding var scrollToOffset: CGFloat?
    @Binding var scrollToIdentifier: String?
    let scrollSpeed: CGFloat

    init(
        isAutoScrolling: Binding<Bool>,
        scrollOffset: Binding<CGFloat> = .constant(0),
        scrollToOffset: Binding<CGFloat?> = .constant(nil),
        scrollToIdentifier: Binding<String?> = .constant(nil),
        scrollSpeed: CGFloat,
        @ViewBuilder content: () -> Content
    ) {
        self._isAutoScrolling = isAutoScrolling
        self._scrollOffset = scrollOffset
        self._scrollToOffset = scrollToOffset
        self._scrollToIdentifier = scrollToIdentifier
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
