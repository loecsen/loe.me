import { store } from '../store.js';

export class LoeShell extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = { isOpen: false, currentView: 'intention' }; // Default view is now 'intention'
  }

  connectedCallback() {
    this.render();
    this.setupStyles();

    this.unsubscribe = store.subscribe(state => {
      const shouldUpdate = this.state.isOpen !== state.isOpen || this.state.currentView !== state.currentView;
      this.state = { isOpen: state.isOpen, currentView: state.currentView };

      if (shouldUpdate) {
        this.updateView();
      }
    });

    // Handle Esc
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.isOpen) {
        store.toggleWidget();
      }
    });
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  setupStyles() {
    // Import shared theme
    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', './src/styles/theme.css');
    this.shadowRoot.appendChild(linkElem);

    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 1000;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.4s ease;
      }

      :host(.open) {
        opacity: 1;
        pointer-events: auto;
      }

      /* Backdrop is darker, more solid/focusing */
      .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(2, 6, 23, 0.8); /* Dark Slate 950, high opacity */
        backdrop-filter: blur(8px);
      }

      /* Modal Container - "Sanctuary" Feel */
      .shell-container {
        position: absolute;
        inset: 40px;
        /* Using the new 'modal-solid' style via variable or generic class if accessible, 
           but here we define specific shell styles to ensure robustness */
        background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f172a 100%); /* Deep cosmic solid */
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 32px; /* Softer, larger radius */
        box-shadow: 
          0 0 0 1px rgba(255,255,255,0.05),
          0 20px 60px -10px rgba(0,0,0,0.5);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        transform: scale(0.95) translateY(20px);
        transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      }

      :host(.open) .shell-container {
        transform: scale(1) translateY(0);
      }
      
      @media (max-width: 640px) {
        .shell-container {
          inset: 0;
          border-radius: 0;
          border: none;
        }
      }

      .content-area {
        flex: 1;
        position: relative;
        /* Ensure views fill the space */
        display: flex;
        flex-direction: column;
      }

      .btn-close {
        position: absolute;
        top: 24px;
        right: 24px;
        z-index: 200;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        color: var(--loe-text-muted);
        width: 40px; height: 40px;
        border-radius: 50%;
        cursor: pointer;
        display: flex; 
        align-items: center; 
        justify-content: center;
        transition: all 0.3s;
        font-size: 14px;
      }
      .btn-close:hover {
        background: rgba(255,255,255,0.1);
        color: white;
        transform: rotate(90deg);
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    this.shadowRoot.innerHTML += `
      <div class="backdrop" id="backdrop"></div>
      
      <div class="shell-container">
        <!-- Close Button (Global) -->
        <button class="btn-close" id="btn-close" title="Close Ritual">✕</button>

        <!-- Main Content Area where we inject Views -->
        <div class="content-area" id="router-outlet"></div>
      </div>
    `;

    // Events
    this.shadowRoot.getElementById('btn-close').addEventListener('click', () => store.toggleWidget());
    this.shadowRoot.getElementById('backdrop').addEventListener('click', () => store.toggleWidget());
  }

  updateView() {
    // 1. Toggle Open State
    if (this.state.isOpen) {
      this.classList.add('open');
    } else {
      this.classList.remove('open');
      return;
    }

    // 2. Router Logic
    const outlet = this.shadowRoot.getElementById('router-outlet');
    outlet.innerHTML = '';
    const view = this.state.currentView;

    if (view === 'intention' || view === 'hub') { // Mapping old 'hub' default to 'intention' conceptually for now if needed.
      // We need to implement IntentionHome, for now we might use placeholder
      outlet.innerHTML = '<loe-intention-home></loe-intention-home>';
    } else if (view === 'ritual' || view === 'player') {
      outlet.innerHTML = '<loe-ritual-player></loe-ritual-player>';
    } else if (view === 'progression') {
      outlet.innerHTML = '<loe-progression></loe-progression>';
    } else {
      // Fallback
      outlet.innerHTML = '<loe-intention-home></loe-intention-home>';
    }
  }
}

customElements.define('loe-shell', LoeShell);
