import { store } from '../store.js';

export class IntentionHome extends HTMLElement {
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
        align-items: center;
        justify-content: center;
        padding: 32px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }

      /* Ambient Light */
      .glow-spot {
        position: absolute;
        width: 300px; height: 300px;
        background: radial-gradient(circle, rgba(216, 180, 254, 0.15) 0%, transparent 70%);
        border-radius: 50%;
        pointer-events: none;
        z-index: 0;
        animation: float 10s infinite ease-in-out;
      }
      .glow-spot.top { top: -100px; right: -50px; }
      .glow-spot.bottom { bottom: -100px; left: -50px; animation-delay: -5s; }

      .content-wrapper {
        position: relative;
        z-index: 10;
        width: 100%;
        max-width: 480px;
        animation: fadeIn 1s ease-out;
      }

      h1 {
        font-family: var(--loe-font-serif);
        font-size: 32px;
        font-weight: 400;
        margin-bottom: 40px;
        line-height: 1.3;
        background: linear-gradient(to right, #fff, #cbd5e1);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      .input-group {
        position: relative;
        margin-bottom: 48px;
      }

      input {
        width: 100%;
        background: transparent;
        border: none;
        border-bottom: 1px solid rgba(255,255,255,0.3);
        color: white;
        font-size: 20px;
        padding: 12px 0;
        text-align: center;
        font-family: var(--loe-font-family);
        transition: var(--loe-transition);
        border-radius: 0; 
      }
      
      input:focus {
        outline: none;
        border-color: var(--loe-color-primary);
        box-shadow: 0 10px 20px -10px rgba(216, 180, 254, 0.2);
      }
      
      input::placeholder {
        color: rgba(255,255,255,0.3);
        font-style: italic;
      }

      .btn-magic {
        background: linear-gradient(135deg, var(--loe-color-primary), #a855f7);
        color: white;
        border: none;
        padding: 16px 48px;
        border-radius: 99px;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        transition: var(--loe-transition);
        position: relative;
        overflow: hidden;
      }

      .btn-magic:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 30px rgba(168, 85, 247, 0.6);
      }

      .sparkle-icon {
        display: inline-block;
        margin-right: 8px;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
        this.shadowRoot.appendChild(style);
    }

    render() {
        this.shadowRoot.innerHTML += `
      <div class="glow-spot top"></div>
      <div class="glow-spot bottom"></div>

      <div class="content-wrapper">
        <h1>Sur quoi veux-tu avancer aujourd'hui ?</h1>
        
        <div class="input-group">
          <input type="text" id="intention-input" placeholder="Ex: Devenir plus confiant à l'oral..." autocomplete="off">
        </div>

        <button class="btn-magic" id="btn-generate">
          <span class="sparkle-icon">✨</span>
          Créer mon Rituel
        </button>
      </div>
    `;
    }

    setupInteractions() {
        const btn = this.shadowRoot.getElementById('btn-generate');
        const input = this.shadowRoot.getElementById('intention-input');

        const submit = () => {
            const intention = input.value.trim();
            if (intention) {
                // Trigger Loading / Magic Animation then navigate
                btn.innerHTML = '✨ Création en cours...';
                btn.style.opacity = '0.8';

                // Simulate API delay
                setTimeout(() => {
                    store.startRitual(intention);
                }, 1500);
            } else {
                input.focus();
                input.style.borderColor = 'var(--loe-color-secondary)';
            }
        };

        btn.addEventListener('click', submit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submit();
        });
    }
}

customElements.define('loe-intention-home', IntentionHome);
