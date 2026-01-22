import { store } from '../store.js';

export class LoeWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupStyles();

    // Subscribe to store updates
    this.unsubscribe = store.subscribe(state => {
      this.updateState(state);
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
      :host {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        font-family: var(--loe-font-family);
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        pointer-events: none; /* Let clicks pass through transparent areas */
      }
      
      * {
        box-sizing: border-box;
        pointer-events: auto; /* Re-enable clicks on children */
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    // We will inject the children components here
    this.shadowRoot.innerHTML += `
      <loe-shell></loe-shell>
      <loe-button></loe-button>
    `;
  }

  updateState(state) {
    // Pass state down if needed, or children can subscribe themselves
  }
}

customElements.define('loe-widget', LoeWidget);
