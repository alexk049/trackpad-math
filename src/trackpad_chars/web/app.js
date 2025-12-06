const mf = document.getElementById('mf');
const statusInd = document.getElementById('status-indicator');

let isRecording = false;
let autoDrawInterval = null;

// --- Settings Logic ---
const autoCheck = document.getElementById('auto-mode-check');
const pauseSlider = document.getElementById('pause-slider');
const pauseVal = document.getElementById('pause-val');

function updateSettings() {
    const auto = autoCheck.checked;
    const pause = parseInt(pauseSlider.value) / 1000; // ms to s
    pauseVal.innerText = pauseSlider.value + 'ms';

    fetch('/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            auto_mode: auto,
            pause_threshold: pause
        })
    }).catch(e => console.error("Failed to update settings", e));
}

autoCheck.addEventListener('change', updateSettings);
pauseSlider.addEventListener('input', updateSettings);
// Init settings on load
updateSettings();


// --- Global Key Listener for Recording ---
document.addEventListener('keydown', async (e) => {
    // Check if Space is pressed AND we aren't typing inside the math field intentionally
    if (e.code === 'Space') {
        e.preventDefault();
        if (e.repeat) return;

        await toggleRecording();
    }
});

const recordBtn = document.getElementById('record-btn');

document.getElementById('record-btn').addEventListener('click', (e) => {
    e.target.blur(); // Remove focus so Spacebar doesn't trigger it again immediately
    toggleRecording();
});

async function toggleRecording() {
    try {
        const response = await fetch('/record/toggle', { method: 'POST' });
        const data = await response.json();

        // Clear existing interval if any
        if (autoDrawInterval) {
            clearInterval(autoDrawInterval);
            autoDrawInterval = null;
        }

        if (data.status === 'recording') {
            isRecording = true;
            recordBtn.innerText = "Stop Rec";
            recordBtn.style.borderColor = "var(--record)";
            recordBtn.style.color = "var(--record)";

            if (autoCheck.checked) {
                statusInd.innerText = "AUTO RECORDING...";
                statusInd.className = "recording";
                // Start Polling
                autoDrawInterval = setInterval(pollRecording, 200);
            } else {
                statusInd.innerText = "RECORDING...";
                statusInd.className = "recording";
            }

        } else if (data.status === 'finished') {
            isRecording = false;
            resetRecordBtn();
            flashStatus(data.symbol);
        } else {
            // Idle/Error
            isRecording = false;
            resetRecordBtn();
            statusInd.innerText = data.message || "Ready";
            statusInd.className = "";
        }

    } catch (err) {
        console.error(err);
        statusInd.innerText = "Error";
        resetRecordBtn();
    }
}

function resetRecordBtn() {
    recordBtn.innerText = "Start Rec";
    recordBtn.style.borderColor = "";
    recordBtn.style.color = "";
}

async function pollRecording() {
    try {
        const res = await fetch('/record/poll');
        const data = await res.json();

        if (data.status === 'finished') {
            // Symbol detected!
            flashStatus(data.symbol);
            // In auto mode, status remains "Recording", just flash the symbol briefly?
            // Or maybe show "Inserted X" then back to "Recording..."
            // Let's create a temp flash but keep the interval running.
        } else if (data.status === 'error') {
            statusInd.innerText = data.message;
            clearInterval(autoDrawInterval);
        }
    } catch (e) {
        console.error(e);
    }
}

function flashStatus(symbol) {
    statusInd.innerText = `Inserted: ${symbol}`;
    statusInd.className = "success";
    insertSymbol(symbol);

    // If auto mode is still on, revert text to "Auto Recording" after short delay
    // But we need to distinguish if we Stopped or just Inserted.
    // If autoDrawInterval is active, we are still recording.
    if (autoDrawInterval) {
        setTimeout(() => {
            if (autoDrawInterval) {
                statusInd.innerText = "AUTO RECORDING...";
                statusInd.className = "recording";
            }
        }, 800);
    } else {
        setTimeout(() => {
            statusInd.innerText = "Ready";
            statusInd.className = "";
        }, 1000);
    }
}

function insertSymbol(symbol) {
    if (!symbol) return;

    let insertVal = symbol;
    // Special handling if needed (none for simpler symbols usually)
    // The model returns 'x', '1', '/', etc.
    if (symbol === '/') insertVal = '\\frac{#@}{#?}';

    mf.executeCommand(['insert', insertVal]);
    mf.focus();
}

// --- Scroll Navigation Logic ---
window.addEventListener('wheel', (e) => {
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
    const sensitivity = document.getElementById('sensitivity-slider').value;
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

// --- Copy Logic ---
document.getElementById('copy-btn').addEventListener('click', () => {
    const latex = mf.getValue();
    navigator.clipboard.writeText(latex).then(() => {
        const btn = document.getElementById('copy-btn');
        const originalText = btn.innerText;
        btn.innerText = "Copied!";
        setTimeout(() => btn.innerText = originalText, 1500);
    });
});
