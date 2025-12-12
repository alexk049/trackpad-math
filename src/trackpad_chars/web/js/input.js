export function initInput(mf, settingsModal, vizModal) {
    const optScroll = document.getElementById('opt-scroll');
    const valScroll = document.getElementById('val-scroll');

    // Initialize scroll value
    if (optScroll && valScroll) {
        optScroll.addEventListener('input', () => {
            valScroll.innerText = optScroll.value;
        });
    }

    window.addEventListener('wheel', (e) => {
        // Only handle scroll for cursor navigation if modals are NOT visible
        if (settingsModal.classList.contains('visible') || vizModal.classList.contains('visible')) {
            // Let normal scrolling work in modals
            return;
        }

        e.preventDefault();

        // Support shift+scroll as horizontal (common mouse behavior)
        let dx = e.deltaX;
        let dy = e.deltaY;

        if (e.shiftKey && dx === 0) {
            dx = dy;
            dy = 0;
        }

        // Sensitivity: Dynamic from slider
        // Slider 1 (Low Sens) -> High Threshold (~40)
        // Slider 20 (High Sens) -> Low Threshold (~1)
        const sensitivity = optScroll ? optScroll.value : 10;
        const threshold = Math.max(0.5, 40 / sensitivity);

        // Axis Dominance: Move only in the direction of strongest scroll
        if (Math.abs(dx) > Math.abs(dy)) {
            // Horizontal
            if (dx < -threshold) {
                // Scroll Left -> move cursor Left
                mf.executeCommand('moveToPreviousChar');
            } else if (dx > threshold) {
                // Scroll Right -> move cursor Right
                mf.executeCommand('moveToNextChar');
            }
        } else {
            // Vertical
            if (dy < -threshold) {
                mf.executeCommand('moveUp');
            } else if (dy > threshold) {
                mf.executeCommand('moveDown');
            }
        }
    }, { passive: false });
}
