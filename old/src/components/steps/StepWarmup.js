export class StepWarmup extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupStyles();

    // Auto-complete after 3 seconds for demo
    setTimeout(() => {
      this.dispatchEvent(new CustomEvent('step-complete', { bubbles: true, composed: true }));
    }, 3000);
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
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        padding: 20px;
        animation: fadeIn 0.5s ease;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      h3 {
        font-size: 24px;
        margin-bottom: 16px;
        color: var(--loe-color-primary);
      }
      
      .card {
        background: var(--loe-color-bg-light);
        padding: 40px;
        border-radius: 16px;
        font-size: 32px;
        font-weight: bold;
        box-shadow: var(--loe-shadow-lg);
        animation: flipIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      @keyframes flipIn {
        from { transform: rotateX(90deg); opacity: 0; }
        to { transform: rotateX(0deg); opacity: 1; }
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    this.shadowRoot.innerHTML += `
      <h3>Warm Up!</h3>
      <div class="card">
        Bonjour 👋
      </div>
      <p style="margin-top: 20px; color: var(--loe-color-text-dim)">Répétez à voix haute...</p>
    `;
  }
}

customElements.define('loe-step-warmup', StepWarmup);
