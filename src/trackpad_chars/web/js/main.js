import { initTheme } from './theme.js';
import { initSettings } from './settings.js';
import { initVisualizer } from './visualizer.js';
import { initRecording } from './recording.js';
import { initInput } from './input.js';

const mf = document.getElementById('mf');
const settingsModal = document.getElementById('settings-modal');
const vizModal = document.getElementById('visualizer-modal');
const mathKeyboardContainer = document.getElementById('math-keyboard-container');

window.addEventListener('DOMContentLoaded', () => {
    // Initialize Modules
    initTheme();
    initSettings();
    initVisualizer(settingsModal);

    // MathField dependent modules
    if (mf) {
        initRecording(mf);
        initInput(mf, settingsModal, vizModal);

        if (window.mathVirtualKeyboard) {
            // Link the keyboard to the math field
            mf.mathVirtualKeyboardPolicy = 'manual';
            // Set container for keyboard
            if (mathKeyboardContainer) {
                window.mathVirtualKeyboard.container = mathKeyboardContainer;
            }
            // Show the keyboard
            window.mathVirtualKeyboard.show();
        }
    } else {
        console.error("MathField element not found!");
    }
});
