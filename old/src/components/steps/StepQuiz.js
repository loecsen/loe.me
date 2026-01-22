export class StepQuiz extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupStyles();

    this.shadowRoot.querySelectorAll('.option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const isCorrect = e.target.dataset.correct === 'true';
        if (isCorrect) {
          e.target.style.background = 'var(--loe-color-success)';
          e.target.style.borderColor = 'var(--loe-color-success)';
          setTimeout(() => {
            this.dispatchEvent(new CustomEvent('step-complete', { bubbles: true, composed: true }));
          }, 1000);
        } else {
          e.target.style.background = 'red';
          e.target.classList.add('shake');
        }
      });
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
        display: flex;
        flex-direction: column;
        padding: 20px;
        height: 100%;
        justify-content: center;
      }
      
      h3 {
        font-size: 20px;
        margin-bottom: 24px;
        text-align: center;
      }

      .options {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .option {
        background: var(--loe-color-bg-light);
        border: 2px solid rgba(255,255,255,0.1);
        padding: 16px;
        border-radius: 12px;
        color: white;
        font-size: 16px;
        cursor: pointer;
        text-align: left;
        transition: var(--loe-transition);
        font-family: inherit;
      }

      .option:hover {
        border-color: var(--loe-color-primary);
        background: rgba(244, 63, 94, 0.1);
      }
      
      .shake {
        animation: shake 0.5s;
      }
      
      @keyframes shake {
        0% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        50% { transform: translateX(5px); }
        75% { transform: translateX(-5px); }
        100% { transform: translateX(0); }
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    this.shadowRoot.innerHTML += `
      <h3>Comment dit-on "Good morning" ?</h3>
      <div class="options">
        <button class="option" data-correct="false">Bonne nuit</button>
        <button class="option" data-correct="true">Bonjour</button>
        <button class="option" data-correct="false">Au revoir</button>
      </div>
    `;
  }
}

customElements.define('loe-step-quiz', StepQuiz);
