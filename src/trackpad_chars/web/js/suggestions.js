const suggestionLabel = document.getElementById('suggestion-label');
const suggestionChips = document.getElementById('suggestion-chips');
const statusText = document.getElementById('status-text');

export function showDidYouMean(predicted, confidence, candidates, recordedStrokes) {
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
                // Transform the chip into an input field
                chip.replaceWith(createOtherInput(recordedStrokes));
            } else {
                // Use stored strokes for teaching
                teachSymbol(s, recordedStrokes);
                statusText.innerText = `Corrected to ${s}`;
                statusText.style.color = "var(--success)";
            }
        };
        suggestionChips.appendChild(chip);
    });
}

function createOtherInput(recordedStrokes) {
    const container = document.createElement('div');
    container.className = 'other-input-container';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.gap = '4px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Symbol';
    input.className = 'other-input';
    input.style.cssText = 'width: 80px; padding: 6px 10px; border: 1px solid var(--card-border); border-radius: var(--radius-sm); background: var(--card-bg); color: var(--text-main); font-size: 0.9rem;';

    const submitBtn = document.createElement('button');
    submitBtn.className = 'chip';
    submitBtn.innerHTML = '✓';
    submitBtn.onclick = () => {
        const label = input.value.trim();
        if (label) {
            teachSymbol(label, recordedStrokes);
            statusText.innerText = `Corrected to ${label}`;
            statusText.style.color = "var(--success)";
            // Clear the suggestion area
            suggestionLabel.style.display = 'none';
            suggestionChips.innerHTML = '';
        }
    };

    // Submit on Enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            submitBtn.click();
        }
    });

    container.appendChild(input);
    container.appendChild(submitBtn);

    // Focus the input
    setTimeout(() => input.focus(), 0);

    return container;
}

export async function teachSymbol(label, strokes) {
    try {
        await fetch('/api/teach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label, strokes })
        });
        // Feedback
    } catch (e) { console.error(e); }
}
