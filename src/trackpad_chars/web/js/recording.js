import { showDidYouMean } from './suggestions.js';

const recordBtn = document.getElementById('record-btn');
const statusText = document.getElementById('status-text');
const optAutoDraw = document.getElementById('opt-auto-draw');

let isRecording = false;
let autoDrawInterval = null;
let lastRecordedStrokes = null; // Store for "Did you mean..." or "Teach"
let mf = null; // MathField reference

export function initRecording(mathField) {
    mf = mathField;

    // Global Key
    document.addEventListener('keydown', async (e) => {
        if (e.code === 'Space' && !e.target.closest('input, textarea')) {
            e.preventDefault();
            if (e.repeat) return;
            await toggleRecording();
        }
    });

    if (recordBtn) {
        recordBtn.addEventListener('click', async () => {
            await toggleRecording();
        });
    }

    // Auto draw polling logic is handled inside toggleRecording
}

export function getLastRecordedStrokes() {
    return lastRecordedStrokes;
}

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

            if (optAutoDraw && optAutoDraw.checked) {
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

    // Store the strokes from the backend for teaching corrections
    lastRecordedStrokes = data.strokes || null;

    // Show suggestions based on candidates
    const candidates = data.candidates || [];
    showDidYouMean(data.symbol, data.confidence, candidates, lastRecordedStrokes);

    if (optAutoDraw && optAutoDraw.checked && autoDrawInterval) {
        setTimeout(() => {
            statusText.innerText = "Auto Recording...";
            statusText.style.color = "var(--danger)";
        }, 1000);
    }
}

function insertSymbol(symbol) {
    if (!mf) return;
    let val = symbol;
    if (val === '/') val = '\\frac{#@}{#?}';
    mf.executeCommand(['insert', val]);
}
