import { store } from '../store.js';

export class RitualPlayer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = {
      stepIndex: 0,
      steps: [
        { type: 'context', title: 'Intention', duration: 5 },
        { type: 'immersion', title: 'Immersion', duration: 10 },
        { type: 'practice', title: 'Pratique', duration: 20 }
      ],
      isComplete: false
    };
  }

  connectedCallback() {
    this.render();
    this.setupStyles();
    this.updateStep();

    this.shadowRoot.getElementById('btn-close').addEventListener('click', () => {
      // Return to intention or home
      store.navigateTo('intention');
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
        height: 100%;
        background: var(--loe-bg-solid); /* Solid background for focus */
        color: var(--loe-text-main);
        position: relative;
        overflow: hidden;
      }

      header {
        padding: 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--loe-border);
      }

      .ritual-meta {
        display: flex;
        flex-direction: column;
      }
      
      .ritual-title {
        font-family: var(--loe-font-serif);
        font-size: 18px;
        color: var(--loe-text-gold);
      }
      
      .ritual-subtitle {
        font-size: 12px;
        color: var(--loe-text-muted);
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .btn-close {
        background: transparent;
        border: 1px solid var(--loe-border);
        color: var(--loe-text-muted);
        width: 36px; height: 36px;
        border-radius: 50%;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: var(--loe-transition);
        font-size: 14px;
      }
      .btn-close:hover {
        border-color: white;
        color: white;
      }

      .step-container {
        flex: 1;
        padding: 40px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        animation: fadeIn 0.5s ease-out;
      }

      h2 {
        font-family: var(--loe-font-serif);
        font-size: 32px;
        margin-bottom: 24px;
        color: white; /* Ensure title pops against the dark shell background */
      }

      p {
        font-size: 18px;
        line-height: 1.6;
        color: var(--loe-text-main); /* Lighter white for text outside cards */
        max-width: 500px;
        margin-bottom: 40px;
      }

      .card-content {
        background: white; /* Explicitly white as requested */
        color: #0f172a; /* Slate 900 - Dark text */
        border: none;
        padding: 32px;
        border-radius: 24px;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3);
        margin-bottom: 40px;
      }
      
      /* Ensure text inside card is dark */
      .card-content p {
        color: #334155; /* Slate 700 */
      }
      
      .card-content span {
         color: #0f172a;
      }

      .btn-primary {
        background: white;
        color: var(--loe-color-primary); /* Purple text on white button */
        border: none;
        padding: 16px 40px;
        border-radius: 99px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        transition: var(--loe-transition);
        box-shadow: 0 10px 20px rgba(0,0,0,0.2);
      }
      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 15px 30px rgba(0,0,0,0.3);
        background: #f8fafc;
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
      <header>
        <div class="ritual-meta">
           <span class="ritual-subtitle">Rituel Quotidien</span>
           <span class="ritual-title">La Confiance en Soi</span>
        </div>
        <button class="btn-close" id="btn-close">✕</button>
      </header>
      
      <div class="step-container" id="step-host">
        <!-- Dynamic Content -->
      </div>
    `;
  }

  updateStep() {
    const container = this.shadowRoot.getElementById('step-host');
    container.innerHTML = '';

    // Simple state flow for MVP
    const step = this.state.steps[this.state.stepIndex];

    if (this.state.isComplete) {
      container.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 16px;">✨</div>
            <h2>Rituel Accompli</h2>
            <p>Tu as fait un pas de plus vers ton intention :<br><strong style="color:white;">"${store.state.currentIntention}"</strong></p>
            <button class="btn-primary" id="btn-finish">Voir ma progression</button>
        `;
      container.querySelector('#btn-finish').addEventListener('click', () => {
        store.completeMission(1); // Update XP
        store.navigateTo('progression');
      });
      return;
    }

    // Render Steps based on type
    if (step.type === 'context') {
      container.innerHTML = `
            <h2>L'Intention</h2>
            <div class="card-content">
               <p style="margin:0; font-style:italic;">"${store.state.currentIntention}"</p>
            </div>
            <p>Aujourd'hui, nous allons explorer comment la posture physique influence ton sentiment de légitimité.</p>
            <button class="btn-primary" id="btn-next">Commencer</button>
        `;
    } else if (step.type === 'immersion') {
      container.innerHTML = `
            <h2>Immersion</h2>
            <div class="card-content" style="display:flex; align-items:center; justify-content:center; height: 150px; background: linear-gradient(135deg, #4c1d95, #2e1065);">
               <span style="font-size: 40px;">🎧</span>
            </div>
            <p>Écoute ce court audio sur le "Power Posing".</p>
            <button class="btn-primary" id="btn-next">J'ai écouté</button>
        `;
    } else if (step.type === 'practice') {
      container.innerHTML = `
            <h2>À toi de jouer</h2>
            <p>Pendant 2 minutes, adopte une "pose de victoire" avant ta prochaine réunion.</p>
            <button class="btn-primary" id="btn-next">C'est fait</button>
        `;
    }

    const nextBtn = container.querySelector('#btn-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.state.stepIndex++;
        if (this.state.stepIndex >= this.state.steps.length) {
          this.state.isComplete = true;
        }
        this.updateStep();
      });
    }
  }
}

customElements.define('loe-ritual-player', RitualPlayer);
