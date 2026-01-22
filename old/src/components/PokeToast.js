export class PokeToast extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.setupStyles();

        // Auto dismiss
        setTimeout(() => {
            this.classList.add('hide');
            setTimeout(() => this.remove(), 300);
        }, 4000);
    }

    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
      :host {
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: #0f172a;
        color: white;
        padding: 12px 24px;
        border-radius: 99px;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 10000;
        font-family: system-ui, sans-serif;
        font-weight: 500;
        animation: slideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        border: 1px solid rgba(255,255,255,0.1);
      }
      
      :host(.hide) {
        opacity: 0;
        transform: translate(-50%, 20px);
        transition: all 0.3s;
      }

      @keyframes slideUp {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
    `;
        this.shadowRoot.appendChild(style);
    }

    render() {
        const msg = this.getAttribute('message') || 'Notification';
        this.shadowRoot.innerHTML = `<span>🔔 ${msg}</span>`;
    }
}

customElements.define('loe-poke', PokeToast);
