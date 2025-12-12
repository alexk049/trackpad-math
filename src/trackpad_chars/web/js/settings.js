import { teachSymbol } from './suggestions.js';
import { getLastRecordedStrokes } from './recording.js';
import { openVisualizer } from './visualizer.js';

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

let selectedLabel = null;

export function initSettings() {
    // --- Settings Modal Logic ---
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            openSettings();
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', closeSettingsModal);
    }

    // Close modal when clicking backdrop
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }

    // --- Teach Logic ---
    if (btnTeach) {
        btnTeach.addEventListener('click', async () => {
            // "Teach" in settings context means "Add last recorded strokes to this label"
            if (!selectedLabel) return;
            const lastRecordedStrokes = getLastRecordedStrokes();

            if (!lastRecordedStrokes) {
                alert("No strokes recorded recently to teach!");
                return;
            }

            await teachSymbol(selectedLabel, lastRecordedStrokes);
            alert(`Added sample to ${selectedLabel}`);
            fetchLabels(); // Refresh counts
        });
    }

    // --- View Logic ---
    if (btnView) {
        btnView.addEventListener('click', async () => {
            if (!selectedLabel) return;
            // Close settings to open visualizer
            closeSettingsModal();
            await openVisualizer(selectedLabel);
        });
    }

    // --- Options Logic ---
    if (optAutoDraw) optAutoDraw.addEventListener('change', updateSettings);
    if (optPause) optPause.addEventListener('input', updateSettings);
    if (optScroll) optScroll.addEventListener('input', () => {
        valScroll.innerText = optScroll.value;
        // Scroll logic handled in input.js
    });

    // Push default settings
    updateSettings();
}

export function openSettings() {
    settingsModal.classList.remove('hidden');
    settingsModal.classList.add('visible');
    fetchLabels();
}

function closeSettingsModal() {
    settingsModal.classList.remove('visible');
    settingsModal.classList.add('hidden');
}

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
    if (!labelsTableBody) return;
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
    if (btnView) btnView.disabled = false;
    if (btnUnlearn) btnUnlearn.disabled = false; // "Unlearn" might need more logic
    if (btnTeach) btnTeach.disabled = false;
}

function updateSettings() {
    if (!optAutoDraw || !optPause) return;

    const auto = optAutoDraw.checked;
    const pause = parseInt(optPause.value) / 1000;
    if (valPause) valPause.innerText = optPause.value + 'ms';
    if (valScroll && optScroll) valScroll.innerText = optScroll.value;

    fetch('/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_mode: auto, pause_threshold: pause })
    }).catch(e => console.error(e));
}
