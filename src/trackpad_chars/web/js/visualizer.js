
const vizModal = document.getElementById('visualizer-modal');
const backVizBtn = document.getElementById('back-visualizer');
const vizCanvas = document.getElementById('visualizer-canvas');
const vizTitle = document.getElementById('viz-title');
const vizMeta = document.getElementById('viz-meta');
const vizSlider = document.getElementById('viz-slider');
const vizPrev = document.getElementById('viz-prev');
const vizNext = document.getElementById('viz-next');

let vizDrawings = [];
let vizCtx = null;

export function initVisualizer(settingsModal) {
    if (vizCanvas) {
        vizCtx = vizCanvas.getContext('2d');
    }

    if (backVizBtn) {
        backVizBtn.addEventListener('click', () => {
            closeVizModal();
            // Reopen settings
            if (settingsModal) {
                settingsModal.classList.remove('hidden');
                settingsModal.classList.add('visible');
            }
        });
    }

    // Close visualizer modal when clicking backdrop
    if (vizModal) {
        vizModal.addEventListener('click', (e) => {
            if (e.target === vizModal) {
                closeVizModal();
            }
        });
    }

    if (vizSlider) {
        vizSlider.addEventListener('input', (e) => showDrawing(parseInt(e.target.value)));
    }

    if (vizPrev) {
        vizPrev.addEventListener('click', () => {
            let v = parseInt(vizSlider.value);
            if (v > 0) { vizSlider.value = v - 1; showDrawing(v - 1); }
        });
    }

    if (vizNext) {
        vizNext.addEventListener('click', () => {
            let v = parseInt(vizSlider.value);
            if (v < vizDrawings.length - 1) { vizSlider.value = v + 1; showDrawing(v + 1); }
        });
    }
}

export async function openVisualizer(label) {
    if (!label) return;
    try {
        const res = await fetch(`/api/drawings?label=${encodeURIComponent(label)}`);
        vizDrawings = await res.json();

        if (vizDrawings.length === 0) return;

        vizModal.classList.remove('hidden');
        vizModal.classList.add('visible');

        // Setup slider
        if (vizSlider) {
            vizSlider.max = vizDrawings.length - 1;
            vizSlider.value = 0;
        }
        showDrawing(0);

    } catch (e) { console.error(e); }
}

function closeVizModal() {
    if (vizModal) {
        vizModal.classList.remove('visible');
        vizModal.classList.add('hidden');
    }
}

function showDrawing(index) {
    const drawing = vizDrawings[index];
    if (!drawing) return;

    if (vizTitle) vizTitle.innerText = `Label: ${drawing.label}`;
    if (vizMeta) vizMeta.innerText = `ID: ${drawing.id.substring(0, 8)}... | Time: ${new Date(drawing.timestamp).toLocaleTimeString()}`;

    drawStrokesOnCanvas(drawing.strokes);
}

function drawStrokesOnCanvas(strokes) {
    if (!vizCtx || !vizCanvas) return;

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
