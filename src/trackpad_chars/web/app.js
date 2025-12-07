const mf = document.getElementById('mf');
const statusText = document.getElementById('status-text');
const suggestionLabel = document.getElementById('suggestion-label');
const suggestionChips = document.getElementById('suggestion-chips');
const mathKeyboardContainer = document.getElementById('math-keyboard-container');
const recordBtn = document.getElementById('record-btn');

// Settings Elements
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings');
const settingsBtn = document.getElementById('settings-btn');
const labelsTableBody = document.querySelector('#labels-table tbody');
const btnView = document.getElementById('btn-view');
const btnUnlearn = document.getElementById('btn-unlearn');
const btnTeach = document.getElementById('btn-teach');

// Options Elements
const optAutoDraw = document.getElementById('opt-auto-draw');
const optPause = document.getElementById('opt-pause');
const valPause = document.getElementById('val-pause');
const optScroll = document.getElementById('opt-scroll');
const valScroll = document.getElementById('val-scroll');

// Visualizer Elements
const vizModal = document.getElementById('visualizer-modal');
const backVizBtn = document.getElementById('back-visualizer');
const vizCanvas = document.getElementById('visualizer-canvas');
const vizCtx = vizCanvas.getContext('2d');
const vizTitle = document.getElementById('viz-title');
const vizMeta = document.getElementById('viz-meta');
const vizSlider = document.getElementById('viz-slider');
const vizPrev = document.getElementById('viz-prev');
const vizNext = document.getElementById('viz-next');

// State
let isRecording = false;
let autoDrawInterval = null;
let lastRecordedStrokes = null; // Store for "Did you mean..." or "Teach"
let selectedLabel = null; // For settings table
let vizDrawings = []; // For visualizer pagination

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    if (window.mathVirtualKeyboard) {
        // Link the keyboard to the math field
        mf.mathVirtualKeyboardPolicy = 'manual';

        // Set container for keyboard
        window.mathVirtualKeyboard.container = mathKeyboardContainer;

        // Show the keyboard
        window.mathVirtualKeyboard.show();
    }

    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('theme-icon').className = 'fa-solid fa-sun';
    }

    // Initial fetch of settings? (If we had a GET endpoint)
    // For now request settings defaults or just use local defaults
    updateSettings(); // Push defaults to backend
});

// --- Theme Toggle ---
document.getElementById('theme-toggle').addEventListener('click', () => {
    const body = document.body;
    const icon = document.getElementById('theme-icon');

    body.classList.toggle('dark-mode');

    if (body.classList.contains('dark-mode')) {
        icon.className = 'fa-solid fa-sun';
        localStorage.setItem('theme', 'dark');
    } else {
        icon.className = 'fa-solid fa-moon';
        localStorage.setItem('theme', 'light');
    }
});

// --- Settings Modal Logic ---
settingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
    setTimeout(() => settingsModal.classList.add('visible'), 10);
    fetchLabels();
});

closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('visible');
    setTimeout(() => settingsModal.classList.add('hidden'), 300);
});

// --- Table Logic ---
async function fetchLabels() {
    try {
        const res = await fetch('/api/labels');
        const data = await res.json();
        renderTable(data);
    } catch (e) {
        console.error(e);
    }
}

function renderTable(data) {
    labelsTableBody.innerHTML = '';
    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.label}</td>
            <td>${item.count}</td>
            <td><span style="color:var(--success)">●</span></td> 
        `;
        tr.onclick = () => selectRow(tr, item.label);
        labelsTableBody.appendChild(tr);
    });
}

function selectRow(tr, label) {
    document.querySelectorAll('#labels-table tr').forEach(r => r.classList.remove('selected'));
    tr.classList.add('selected');
    selectedLabel = label;

    // Enable buttons
    btnView.disabled = false;
    btnUnlearn.disabled = false; // "Unlearn" might need more logic (delete all?)
    btnTeach.disabled = false;
}

// --- Visualizer Logic ---
btnView.addEventListener('click', async () => {
    if (!selectedLabel) return;
    try {
        const res = await fetch(`/api/drawings?label=${encodeURIComponent(selectedLabel)}`);
        vizDrawings = await res.json();

        if (vizDrawings.length === 0) return;

        // Open Viz Modal
        settingsModal.classList.remove('visible');
        setTimeout(() => settingsModal.classList.add('hidden'), 300);

        vizModal.classList.remove('hidden');
        setTimeout(() => vizModal.classList.add('visible'), 10);

        // Setup slider
        vizSlider.max = vizDrawings.length - 1;
        vizSlider.value = 0;
        showDrawing(0);

    } catch (e) { console.error(e); }
});

backVizBtn.addEventListener('click', () => {
    vizModal.classList.remove('visible');
    setTimeout(() => {
        vizModal.classList.add('hidden');
        // Reopen settings
        settingsModal.classList.remove('hidden');
        setTimeout(() => settingsModal.classList.add('visible'), 10);
    }, 300);
});

vizSlider.addEventListener('input', (e) => showDrawing(parseInt(e.target.value)));
vizPrev.addEventListener('click', () => {
    let v = parseInt(vizSlider.value);
    if (v > 0) { vizSlider.value = v - 1; showDrawing(v - 1); }
});
vizNext.addEventListener('click', () => {
    let v = parseInt(vizSlider.value);
    if (v < vizDrawings.length - 1) { vizSlider.value = v + 1; showDrawing(v + 1); }
});

function showDrawing(index) {
    const drawing = vizDrawings[index];
    if (!drawing) return;

    vizTitle.innerText = `Label: ${drawing.label}`;
    vizMeta.innerText = `ID: ${drawing.id.substring(0, 8)}... | Time: ${new Date(drawing.timestamp).toLocaleTimeString()}`;

    drawStrokesOnCanvas(drawing.strokes);
}

function drawStrokesOnCanvas(strokes) {
    vizCtx.clearRect(0, 0, vizCanvas.width, vizCanvas.height);
    vizCtx.strokeStyle = '#fff';
    vizCtx.lineWidth = 2;

    // Find bounds for normalization (simple centered fit)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    strokes.forEach(s => s.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }));

    const margin = 20;
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    // Scale factor
    const scale = Math.min((vizCanvas.width - margin * 2) / width, (vizCanvas.height - margin * 2) / height);

    strokes.forEach(stroke => {
        if (stroke.length === 0) return;
        vizCtx.beginPath();
        // Centering offset
        const offsetX = (vizCanvas.width - width * scale) / 2 - minX * scale;
        const offsetY = (vizCanvas.height - height * scale) / 2 - minY * scale;

        vizCtx.moveTo(stroke[0].x * scale + offsetX, stroke[0].y * scale + offsetY);
        for (let i = 1; i < stroke.length; i++) {
            vizCtx.lineTo(stroke[i].x * scale + offsetX, stroke[i].y * scale + offsetY);
        }
        vizCtx.stroke();
    });
}


// --- Teach Logic (Settings) ---
btnTeach.addEventListener('click', async () => {
    // "Teach" in settings context means "Add last recorded strokes to this label"
    if (!selectedLabel) return;
    if (!lastRecordedStrokes) {
        alert("No strokes recorded recently to teach!");
        return;
    }

    await teachSymbol(selectedLabel, lastRecordedStrokes);
    alert(`Added sample to ${selectedLabel}`);
    fetchLabels(); // Refresh counts
});

// --- Main Recording Logic (Matches old logic but updated UI) ---

// Global Key
document.addEventListener('keydown', async (e) => {
    if (e.code === 'Space' && !e.target.closest('input, textarea')) {
        e.preventDefault();
        if (e.repeat) return;
        await toggleRecording();
    }
});

recordBtn.addEventListener('click', async () => {
    await toggleRecording();
});

async function toggleRecording() {
    try {
        const response = await fetch('/record/toggle', { method: 'POST' });
        const data = await response.json();

        if (autoDrawInterval) {
            clearInterval(autoDrawInterval);
            autoDrawInterval = null;
        }

        if (data.status === 'recording') {
            isRecording = true;
            statusText.innerText = data.message;
            statusText.style.color = "var(--danger)";
            recordBtn.innerHTML = 'Stop Recording [space]';

            if (optAutoDraw.checked) {
                autoDrawInterval = setInterval(pollRecording, 100);
            }
        } else if (data.status === 'finished') {
            handleFinished(data);
        } else {
            isRecording = false;
            statusText.innerText = data.message || "Ready";
            statusText.style.color = "var(--text-white)";
            recordBtn.innerHTML = 'Start Recording [space]';
        }
    } catch (e) { console.error(e); }
}

async function pollRecording() {
    try {
        const res = await fetch('/record/poll');
        const data = await res.json();
        if (data.status === 'finished') {
            handleFinished(data);
        }
    } catch (e) { console.error(e); }
}

function handleFinished(data) {
    statusText.innerText = `Inserted: ${data.symbol} (${Math.round(data.confidence * 100)}%)`;
    statusText.style.color = "var(--success)";

    insertSymbol(data.symbol);

    // Save last strokes via a hack (we need strokes for teaching, but the backend doesn't return them in finish response usually)
    // We should probably ask backend for them, or assume backend saved them in memory.
    // For now, let's assume we can teach "Last Recorded" by just sending `strokes: null` to `/api/teach` which defaults to recorder.last_strokes in backend improvement I made.
    // In frontend state, let's just mark that we have something.
    lastRecordedStrokes = null; // Backend uses its internal memory if we send null

    // Show suggestions based on candidates
    const candidates = data.candidates || [];
    showDidYouMean(data.symbol, data.confidence, candidates);

    if (optAutoDraw.checked && autoDrawInterval) {
        setTimeout(() => {
            statusText.innerText = "Auto Recording...";
            statusText.style.color = "var(--danger)";
        }, 1000);
    }
}

function insertSymbol(symbol) {
    let val = symbol;
    if (val === '/') val = '\\frac{#@}{#?}';
    mf.executeCommand(['insert', val]);
}

// --- Did You Mean / Suggestions ---
function showDidYouMean(predicted, confidence, candidates) {
    // Hide suggestions if confidence is perfect (1.0)
    if (confidence >= 0.99) {
        suggestionLabel.style.display = 'none';
        suggestionChips.innerHTML = '';
        return;
    }

    suggestionLabel.style.display = 'block';
    suggestionChips.innerHTML = '';

    // Use actual candidates from model, excluding the top prediction
    const alts = candidates
        .filter(c => c.symbol !== predicted)
        .slice(0, 4)
        .map(c => c.symbol);

    // Add "Other" option
    alts.push("Other");

    alts.forEach(s => {
        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.innerText = s;
        chip.onclick = () => {
            if (s === 'Other') {
                // Open settings to pick ANY label
                settingsBtn.click();
            } else {
                teachSymbol(s, null);
                // Note: We don't re-insert, just teach the correction
                statusText.innerText = `Corrected to ${s}`;
            }
        };
        suggestionChips.appendChild(chip);
    });
}

async function teachSymbol(label, strokes) {
    try {
        await fetch('/api/teach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label, strokes })
        });
        // Feedback
    } catch (e) { console.error(e); }
}


// --- Options Logic ---
function updateSettings() {
    const auto = optAutoDraw.checked;
    const pause = parseInt(optPause.value) / 1000;
    valPause.innerText = optPause.value + 'ms';
    valScroll.innerText = optScroll.value;

    fetch('/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_mode: auto, pause_threshold: pause })
    }).catch(e => console.error(e));
}

optAutoDraw.addEventListener('change', updateSettings);
optPause.addEventListener('input', updateSettings);
optScroll.addEventListener('input', () => {
    valScroll.innerText = optScroll.value;
    // Scroll logic handled in scroll listener
});



// // --- Copy Logic ---
// document.getElementById('copy-btn').addEventListener('click', () => {
//     navigator.clipboard.writeText(mf.getValue());
//     const btn = document.getElementById('copy-btn');
//     btn.innerText = "Copied!";
//     setTimeout(() => btn.innerText = "Copy as LaTeX", 1500);
// });

// --- Scroll Navigation Logic ---
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
    const sensitivity = optScroll.value;
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
