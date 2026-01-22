import { store } from '../store.js';

export class LoeButton extends HTMLElement {
  constructor() {
    super();
    // No Shadow DOM for sub-components, they use the Host's Shadow DOM styles
    // But standard practice for custom elements often implies Shadow DOM. 
    // To keep it simple and share styles easily, we can stick to Light DOM 
    // INSIDE the parent's Shadow DOM.
    // However, for encapsulation, let's use Shadow DOM but import the shared theme.
    this.attachShadow({ mode: 'open' });
    this.state = { isOpen: false };
  }

  connectedCallback() {
    this.render();
    this.setupStyles();

    this.unsubscribe = store.subscribe(state => {
      if (this.state.isOpen !== state.isOpen) {
        this.state.isOpen = state.isOpen;
        this.updateView();
      }
    });

    this.shadowRoot.querySelector('button').addEventListener('click', () => {
      store.toggleWidget();
    });
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
  }

  setupStyles() {
    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', './src/styles/theme.css');
    this.shadowRoot.appendChild(linkElem);

    const style = document.createElement('style');
    style.textContent = `
      button {
        background: var(--loe-color-primary);
        color: white;
        border: none;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: var(--loe-shadow-lg);
        transition: var(--loe-transition);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        margin-top: 16px;
      }

      button:hover {
        background: var(--loe-color-primary-hover);
        transform: scale(1.05);
        box-shadow: var(--loe-shadow-glow);
      }
      
      button:active {
        transform: scale(0.95);
      }

      .icon {
        transition: var(--loe-transition);
      }

      /* Rotate icon when open */
      :host(.open) .icon {
        transform: rotate(45deg);
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    this.shadowRoot.innerHTML += `
      <button aria-label="Open Loe.me Missions">
        <span class="icon">🚀</span>
      </button>
    `;
  }

  updateView() {
    const btn = this.shadowRoot.querySelector('button');
    const icon = this.shadowRoot.querySelector('.icon');

    if (this.state.isOpen) {
      icon.textContent = '✕'; // Close icon
      // We could also toggle a class on the host
    } else {
      icon.textContent = '🚀';
    }
  }
}

customElements.define('loe-button', LoeButton);
