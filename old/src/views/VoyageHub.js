import { store } from '../store.js';

export class ProgressionView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupStyles();
    this.setupInteractions();
  }

  setupStyles() {
    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', './src/styles/theme.css');
    this.shadowRoot.appendChild(linkElem);

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--loe-bg-cosmic);
        color: var(--loe-text-main);
        position: relative;
        overflow: hidden;
      }

      /* Constellation Container */
      .universe {
        flex: 1;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      /* Central Core (User Identity) */
      .core-identity {
        width: 80px; height: 80px;
        background: radial-gradient(circle, var(--loe-text-gold), #b45309);
        border-radius: 50%;
        box-shadow: 0 0 50px rgba(251, 191, 36, 0.4);
        z-index: 10;
        animation: pulse-core 4s infinite ease-in-out;
        display: flex;
        align-items: center; justify-content: center;
        font-size: 24px;
        color: rgba(255,255,255,0.8);
      }

      /* Orbiting Stars */
      .orbit-ring {
        position: absolute;
        border: 1px dashed rgba(255,255,255,0.1);
        border-radius: 50%;
        pointer-events: none;
      }
      .orbit-1 { width: 200px; height: 200px; animation: spin 60s linear infinite; }
      .orbit-2 { width: 350px; height: 350px; animation: spin 90s linear infinite reverse; }

      .star-node {
        position: absolute;
        width: 16px; height: 16px;
        background: white;
        border-radius: 50%;
        box-shadow: 0 0 10px white;
        transition: var(--loe-transition);
        cursor: pointer;
        pointer-events: auto;
      }

      .star-node.done { background: var(--loe-color-success); box-shadow: 0 0 15px var(--loe-color-success); }
      .star-node:hover { transform: scale(1.5); }

      /* UI Overlay */
      .ui-overlay {
        position: absolute;
        top: 24px; left: 0; right: 0;
        padding: 0 24px;
        display: flex;
        justify-content: space-between;
        pointer-events: none;
      }
      .stat-pill {
        background: white; /* High contrast */
        color: #0f172a;
        padding: 8px 16px;
        border-radius: 99px;
        font-size: 14px; /* Slightly larger for readbility */
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        display: flex; gap: 8px; align-items: center;
      }

      .footer-cta {
        position: absolute;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        padding: 0 24px;
        width: 100%;
        text-align: center;
      }

      .btn-new {
        background: white;
        border: none;
        color: var(--loe-color-primary);
        padding: 14px 32px;
        border-radius: 99px;
        cursor: pointer;
        transition: var(--loe-transition);
        font-family: var(--loe-font-family);
        font-weight: 700;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        font-size: 16px;
      }
      .btn-new:hover {
        transform: translateY(-2px);
        box-shadow: 0 15px 35px rgba(0,0,0,0.3);
      }

      @keyframes pulse-core {
        0%, 100% { transform: scale(1); box-shadow: 0 0 50px rgba(251, 191, 36, 0.4); }
        50% { transform: scale(1.1); box-shadow: 0 0 80px rgba(251, 191, 36, 0.6); }
      }
      @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    this.shadowRoot.innerHTML += `
      <div class="ui-overlay">
         <div class="stat-pill">
           <span>✨</span>
           <span>Niveau 1</span>
         </div>
         <div class="stat-pill">
           <span>🔥</span>
           <span>7 jours</span>
         </div>
      </div>

      <div class="universe">
         <div class="orbit-ring orbit-2">
            <div class="star-node done" style="top: 10%; right: 20%;" title="Mission: Confiance"></div>
            <div class="star-node" style="bottom: 30%; left: 10%;"></div>
         </div>
         <div class="orbit-ring orbit-1">
            <div class="star-node done" style="top: 0; left: 50%;"></div>
            <div class="star-node done" style="bottom: 20%; right: 20%;"></div>
            <div class="star-node" style="top: 40%; left: 0%;"></div>
         </div>
         
         <div class="core-identity">
            <span>🧙‍♂️</span>
         </div>
      </div>

      <div class="footer-cta">
         <button class="btn-new" id="btn-home">Nouvelle Intention</button>
      </div>
    `;
  }

  setupInteractions() {
    this.shadowRoot.getElementById('btn-home').addEventListener('click', () => {
      store.navigateTo('intention');
    });
  }
}

customElements.define('loe-progression', ProgressionView);
