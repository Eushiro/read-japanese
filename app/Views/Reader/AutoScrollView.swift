import SwiftUI

#if canImport(UIKit)
import UIKit

/// A scroll view that supports smooth auto-scrolling triggered by long press
struct AutoScrollView<Content: View>: UIViewRepresentable {
    let content: Content
    @Binding var isAutoScrolling: Bool
    @Binding var scrollOffset: CGFloat
    @Binding var scrollToOffset: CGFloat?
    @Binding var scrollToIdentifier: String?
    let scrollSpeed: CGFloat
    var onSwipeBack: (() -> Void)?

    init(
        isAutoScrolling: Binding<Bool>,
        scrollOffset: Binding<CGFloat> = .constant(0),
        scrollToOffset: Binding<CGFloat?> = .constant(nil),
        scrollToIdentifier: Binding<String?> = .constant(nil),
        scrollSpeed: CGFloat,
        onSwipeBack: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self._isAutoScrolling = isAutoScrolling
        self._scrollOffset = scrollOffset
        self._scrollToOffset = scrollToOffset
        self._scrollToIdentifier = scrollToIdentifier
        self.scrollSpeed = scrollSpeed
        self.onSwipeBack = onSwipeBack
        self.content = content()
    }

    func makeUIView(context: Context) -> UIScrollView {
        let scrollView = UIScrollView()
        scrollView.delegate = context.coordinator
        scrollView.showsVerticalScrollIndicator = true
        scrollView.showsHorizontalScrollIndicator = false
        scrollView.alwaysBounceVertical = true

        // These settings allow taps to reach content while still enabling scrolling
        scrollView.delaysContentTouches = false
        scrollView.canCancelContentTouches = true

        let hostingController = UIHostingController(rootView: content)
        hostingController.view.backgroundColor = .clear
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false

        // Critical: Make hosting view not intercept touches it doesn't need
        hostingController.view.isUserInteractionEnabled = true

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

        // Long press for auto-scroll
        let longPressGesture = UILongPressGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleLongPress(_:))
        )
        longPressGesture.minimumPressDuration = 0.5
        longPressGesture.delegate = context.coordinator
        scrollView.addGestureRecognizer(longPressGesture)

        // Edge pan for swipe-back
        let edgePanGesture = UIScreenEdgePanGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleEdgePan(_:))
        )
        edgePanGesture.edges = .left
        edgePanGesture.delegate = context.coordinator
        scrollView.addGestureRecognizer(edgePanGesture)

        return scrollView
    }

    func updateUIView(_ scrollView: UIScrollView, context: Context) {
        context.coordinator.hostingController?.rootView = content
        context.coordinator.hostingController?.view.invalidateIntrinsicContentSize()
        context.coordinator.hostingController?.view.setNeedsLayout()
        context.coordinator.hostingController?.view.layoutIfNeeded()
        context.coordinator.currentSpeed = scrollSpeed

        if let targetOffset = scrollToOffset {
            if scrollView.contentSize.height > scrollView.bounds.height {
                let clampedOffset = min(targetOffset, max(0, scrollView.contentSize.height - scrollView.bounds.height))
                scrollView.setContentOffset(CGPoint(x: 0, y: clampedOffset), animated: true)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    self.scrollToOffset = nil
                }
            }
        }

        if let identifier = scrollToIdentifier {
            if let hostingView = context.coordinator.hostingController?.view {
                if let targetView = findView(withAccessibilityIdentifier: identifier, in: hostingView) {
                    let frameInScrollView = targetView.convert(targetView.bounds, to: scrollView)
                    let targetOffset = max(0, frameInScrollView.origin.y)
                    let clampedOffset = min(targetOffset, max(0, scrollView.contentSize.height - scrollView.bounds.height))
                    scrollView.setContentOffset(CGPoint(x: 0, y: clampedOffset), animated: true)
                }
            }
            DispatchQueue.main.async {
                self.scrollToIdentifier = nil
            }
        }

        if isAutoScrolling && !context.coordinator.isScrolling {
            context.coordinator.startAutoScroll()
        } else if !isAutoScrolling && context.coordinator.isScrolling {
            context.coordinator.stopAutoScroll()
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    private func findView(withAccessibilityIdentifier identifier: String, in view: UIView) -> UIView? {
        if view.accessibilityIdentifier == identifier { return view }
        for subview in view.subviews {
            if let found = findView(withAccessibilityIdentifier: identifier, in: subview) {
                return found
            }
        }
        return nil
    }

    class Coordinator: NSObject, UIScrollViewDelegate, UIGestureRecognizerDelegate {
        var parent: AutoScrollView
        var hostingController: UIHostingController<Content>?
        weak var scrollView: UIScrollView?
        private var displayLink: CADisplayLink?
        private var lastTimestamp: CFTimeInterval = 0
        var currentSpeed: CGFloat = 50
        var isScrolling: Bool = false
        private var isProgrammaticScroll: Bool = false
        private var longPressActive: Bool = false
        private var lastReportedOffset: CGFloat = 0
        private var offsetUpdateWorkItem: DispatchWorkItem?

        init(parent: AutoScrollView) {
            self.parent = parent
            self.currentSpeed = parent.scrollSpeed
        }

        // MARK: - UIGestureRecognizerDelegate

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            // Allow edge pan to work with scroll
            if gestureRecognizer is UIScreenEdgePanGestureRecognizer {
                return true
            }
            return true
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldBeRequiredToFailBy otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            // Edge pan takes priority over scroll pan
            if gestureRecognizer is UIScreenEdgePanGestureRecognizer,
               otherGestureRecognizer == scrollView?.panGestureRecognizer {
                return true
            }
            return false
        }

        // MARK: - Gesture Handlers

        @objc func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
            switch gesture.state {
            case .began:
                guard let scrollView = scrollView,
                      scrollView.contentSize.height > scrollView.bounds.height else { return }
                longPressActive = true
                startAutoScroll()
                DispatchQueue.main.async { self.parent.isAutoScrolling = true }
            case .ended, .cancelled, .failed:
                longPressActive = false
                stopAutoScroll()
                DispatchQueue.main.async { self.parent.isAutoScrolling = false }
            default:
                break
            }
        }

        @objc func handleEdgePan(_ gesture: UIScreenEdgePanGestureRecognizer) {
            if gesture.state == .ended {
                let velocity = gesture.velocity(in: gesture.view)
                let translation = gesture.translation(in: gesture.view)
                if translation.x > 80 || velocity.x > 400 {
                    DispatchQueue.main.async { self.parent.onSwipeBack?() }
                }
            }
        }

        // MARK: - Auto Scroll

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
            guard let scrollView = scrollView else { stopAutoScroll(); return }

            if !longPressActive {
                stopAutoScroll()
                DispatchQueue.main.async { self.parent.isAutoScrolling = false }
                return
            }

            if lastTimestamp == 0 { lastTimestamp = displayLink.timestamp; return }

            let deltaTime = displayLink.timestamp - lastTimestamp
            lastTimestamp = displayLink.timestamp

            if deltaTime > 0.5 { return }

            let scrollDelta = currentSpeed * CGFloat(deltaTime)
            var newOffset = scrollView.contentOffset
            newOffset.y += scrollDelta

            let maxOffset = max(0, scrollView.contentSize.height - scrollView.bounds.height)
            if newOffset.y >= maxOffset {
                newOffset.y = maxOffset
                scrollView.contentOffset = newOffset
                stopAutoScroll()
                DispatchQueue.main.async { self.parent.isAutoScrolling = false }
                return
            }

            if newOffset.y >= 0 {
                isProgrammaticScroll = true
                scrollView.contentOffset = newOffset
            }
        }

        // MARK: - UIScrollViewDelegate

        func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
            if isScrolling && !isProgrammaticScroll {
                longPressActive = false
                stopAutoScroll()
                DispatchQueue.main.async { self.parent.isAutoScrolling = false }
            }
            isProgrammaticScroll = false
        }

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            let currentOffset = max(0, scrollView.contentOffset.y)
            let delta = abs(currentOffset - lastReportedOffset)
            guard delta > 2 else { return }

            offsetUpdateWorkItem?.cancel()
            let workItem = DispatchWorkItem { [weak self] in
                guard let self = self else { return }
                self.lastReportedOffset = currentOffset
                self.parent.scrollOffset = currentOffset
            }
            offsetUpdateWorkItem = workItem
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.016, execute: workItem)
        }
    }
}

#else
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
        onSwipeBack: (() -> Void)? = nil,
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

#Preview {
    struct PreviewWrapper: View {
        @State private var isAutoScrolling = false

        var body: some View {
            VStack {
                Text(isAutoScrolling ? "Scrolling..." : "Long press to auto-scroll")
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
