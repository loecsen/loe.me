import { store } from './store.js';

import './components/LoeWidget.js';
import './components/LoeButton.js';
import './components/LoeShell.js';

console.log('Loe.me Widget Initialized');

// Temporary debug helper
window.loeStore = store;

/**
 * Initialize the widget elements.
 * For now, we just log that we are ready.
 * In the next steps, we will mount the root component.
 */
import './views/VoyageHub.js';
import './views/IntentionHome.js';
import './views/RitualPlayer.js';
import './views/GroupView.js';
import './views/BadgesPanel.js';
import './components/PokeToast.js';

function init() {
    const root = document.getElementById('loe-widget-root');
    if (!root) {
        console.warn('Loe.me root element not found!');
        return;
    }

    const widget = document.createElement('loe-widget');
    root.appendChild(widget);
    console.log('Loe.me Widget mounted.');

    // Debug: Prove execution
    const debug = document.createElement('div');
    debug.textContent = '✅ JS Executed. Widget mounted.';
    debug.style.cssText = 'position:fixed; bottom: 10px; left: 10px; background: #cfc; color: green; padding: 5px; opacity: 0.8; font-size: 12px;';
    document.body.appendChild(debug);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
