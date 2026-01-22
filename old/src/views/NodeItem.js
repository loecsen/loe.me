import { store } from '../store.js';

export class LoeNode extends HTMLElement {
  constructor() {
    super();
    // Use Light DOM for better SVG integration if inside SVG, 
    // but here we are likely overlaying divs on top of SVG or using absolute positioning.
    // Let's use Shadow DOM for style encapsulation.
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['status', 'x', 'y', 'label'];
  }

  connectedCallback() {
    this.render();
    this.setupStyles();

    this.shadowRoot.querySelector('.node-btn').addEventListener('click', () => {
      const id = this.getAttribute('id');
      const status = this.getAttribute('status');

      console.log(`Node clicked: ${id}, status: ${status}`);

      if (status === 'today') {
        store.navigateTo('player');
      } else if (status === 'done') {
        // Future: Open summary
        console.log('Open summary');
      } else if (status === 'locked') {
        console.log('Locked mission');
      }
    });
  }

  setupStyles() {
    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', './src/styles/theme.css');
    this.shadowRoot.appendChild(linkElem);

    const style = document.createElement('style');
    style.textContent = `
      :host {
        position: absolute;
        transform: translate(-50%, -50%); /* Center on coordinates */
        z-index: 10;
        transition: top 0.3s, left 0.3s;
      }
      
      .node-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 3px solid transparent; /* Expanding border for status */
        background: var(--loe-color-bg-light);
        color: var(--loe-color-text);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-family: inherit;
        font-weight: 700;
        font-size: 14px;
        transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        position: relative;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      }

      /* STATES */
      
      /* LOCKED */
      :host([status="locked"]) .node-btn {
        background: var(--loe-color-locked);
        color: rgba(255,255,255,0.3);
        cursor: not-allowed;
        box-shadow: none;
        width: 36px; 
        height: 36px;
      }

      /* DONE */
      :host([status="done"]) .node-btn {
        background: #0ea5e9; /* Sky 500 */
        color: white;
        border-color: #0284c7;
      }
      
      /* TODAY (Active) */
      :host([status="today"]) .node-btn {
        background: var(--loe-color-primary);
        color: white;
        width: 56px;
        height: 56px;
        font-size: 18px;
        box-shadow: 0 0 0 6px rgba(244, 63, 94, 0.2), var(--loe-shadow-glow);
        animation: pulse 2s infinite;
        z-index: 20;
      }

      /* MYSTERY */
      :host([status="mystery"]) .node-btn {
        background: #f59e0b; /* Amber 500 */
        color: white;
      }

      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(244, 63, 94, 0); }
        100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); }
      }

      .label {
        position: absolute;
        bottom: -24px;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        font-size: 12px;
        font-weight: 500;
        color: var(--loe-color-text-dim);
        background: rgba(0,0,0,0.8);
        padding: 2px 6px;
        border-radius: 4px;
        opacity: 0;
        transition: opacity 0.2s;
        pointer-events: none;
      }

      .node-btn:hover .label {
        opacity: 1;
      }
      
      .icon {
        display: block;
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    const status = this.getAttribute('status') || 'locked';
    const label = this.getAttribute('label') || '';

    let content = this.getAttribute('index');
    if (status === 'done') content = '✓';
    if (status === 'locked') content = '🔒';
    if (status === 'today') content = '★';
    if (status === 'mystery') content = '?';

    this.style.left = `${this.getAttribute('x')}%`;
    this.style.top = `${this.getAttribute('y')}%`;

    this.shadowRoot.innerHTML += `
      <button class="node-btn" aria-label="Mission ${label}">
        <span class="icon">${content}</span>
        <span class="label">${label}</span>
      </button>
    `;
  }
}

customElements.define('loe-node', LoeNode);
