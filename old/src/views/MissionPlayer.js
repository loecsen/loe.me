import { store } from '../store.js';
import '../components/steps/StepWarmup.js';
import '../components/steps/StepQuiz.js';

export class MissionPlayer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = {
      stepIndex: 0,
      steps: ['warmup', 'quiz'],
      isComplete: false
    };
  }

  connectedCallback() {
    this.render();
    this.setupStyles();
    this.updateStep();

    this.shadowRoot.addEventListener('step-complete', () => {
      this.nextStep();
    });

    this.shadowRoot.getElementById('btn-close').addEventListener('click', () => {
      store.navigateTo('hub');
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
        /* Inherit the space theme classes from the markup */
        position: relative;
        overflow: hidden;
      }

      .player-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        position: relative;
        z-index: 10; /* Above stars/nebula */
      }

      header {
        padding: 20px 24px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(15, 23, 42, 0.4);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }

      .progress-bar {
        flex: 1;
        height: 8px;
        background: rgba(255,255,255,0.1);
        border-radius: 99px;
        margin: 0 24px;
        overflow: hidden;
        position: relative;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #22c55e, #4ade80);
        width: 0%;
        transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 0 15px rgba(34, 197, 94, 0.5);
      }

      #btn-close {
        background: rgba(255,255,255,0.1);
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        width: 36px; height: 36px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 50%;
        transition: all 0.2s;
        backdrop-filter: blur(4px);
      }
      #btn-close:hover {
        background: rgba(255,255,255,0.2);
        transform: scale(1.1);
      }

      .step-container {
        flex: 1;
        overflow-y: auto;
        position: relative;
        padding: 24px;
        display: flex;
        flex-direction: column;
      }
      
      .success-screen {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        animation: zoomIn 0.5s ease-out;
      }
      
      .success-icon {
        font-size: 80px;
        margin-bottom: 24px;
        filter: drop-shadow(0 0 30px rgba(74, 222, 128, 0.4));
        animation: float 3s ease-in-out infinite;
      }

      h1 { 
        font-size: 36px; 
        margin-bottom: 8px; 
        font-weight: 800; 
        background: linear-gradient(135deg, #fff, #cbd5e1); 
        -webkit-background-clip: text; 
        -webkit-text-fill-color: transparent;
      }
      
      .btn-primary {
         background: linear-gradient(135deg, #22c55e, #16a34a);
         color: white;
         border: none;
         padding: 18px 40px;
         font-size: 18px;
         border-radius: 99px;
         font-weight: 700;
         cursor: pointer;
         margin-top: 40px;
         box-shadow: 0 10px 30px rgba(34, 197, 94, 0.4);
         transition: all 0.2s;
         letter-spacing: 0.5px;
      }
      .btn-primary:active { transform: scale(0.95); }
      .btn-primary:hover {
         transform: translateY(-2px);
         box-shadow: 0 15px 40px rgba(34, 197, 94, 0.5);
      }

      .stat-card {
        background: rgba(255,255,255,0.05);
        padding: 16px 24px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
      }

      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    // We wrap everything in the shared theme classes
    this.shadowRoot.innerHTML += `
      <!-- Shared Background for seamless transition -->
      <div class="bg-space-deep" style="position: absolute; inset: 0;"></div>
      <div class="nebula one"></div>
      <div class="nebula two"></div>
      <div class="stars"></div>

      <div class="player-container">
        <header>
          <span style="font-size: 14px; font-weight: 700; color: #cbd5e1; letter-spacing: 1px; text-transform: uppercase;">Mission 3</span>
          <div class="progress-bar">
            <div class="progress-fill" id="progress"></div>
          </div>
          <button id="btn-close" title="Suspendre">✕</button>
        </header>
        
        <div class="step-container" id="step-host">
          <!-- Dynamic Step Component Here -->
        </div>
      </div>
    `;
  }

  updateStep() {
    const container = this.shadowRoot.getElementById('step-host');
    container.innerHTML = ''; // Clear previous

    const progress = ((this.state.stepIndex) / this.state.steps.length) * 100;
    this.shadowRoot.getElementById('progress').style.width = `${progress}%`;

    const stepType = this.state.steps[this.state.stepIndex];

    if (this.state.isComplete) {
      this.shadowRoot.getElementById('progress').style.width = `100%`;
      container.innerHTML = `
         <div class="success-screen">
            <div class="success-icon">🎉</div>
            <h1>Mission Complétée !</h1>
            <p style="color: #94a3b8; font-size: 16px; margin-bottom: 32px;">Tu as fait un pas de plus vers la maîtrise.</p>
            
            <div style="display:flex; gap:16px;">
                <div class="stat-card">
                   <span style="display:block; font-size:12px; color:#cbd5e1; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">XP Gagné</span>
                   <span style="display:block; font-size:28px; font-weight:800; color:#4ade80;">+20</span>
                </div>
                <div class="stat-card">
                   <span style="display:block; font-size:12px; color:#cbd5e1; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Série</span>
                   <span style="display:block; font-size:28px; font-weight:800; color:#f43f5e;">8 jours 🔥</span>
                </div>
            </div>
            
            <button class="btn-primary" id="btn-finish">Continuer le voyage</button>
         </div>
       `;
      container.querySelector('#btn-finish').addEventListener('click', () => {
        store.completeMission(3);
        store.navigateTo('hub');
      });
      return;
    }

    let stepEl;
    if (stepType === 'warmup') stepEl = document.createElement('loe-step-warmup');
    if (stepType === 'quiz') stepEl = document.createElement('loe-step-quiz');

    if (stepEl) {
      container.appendChild(stepEl);
    }
  }

  nextStep() {
    this.state.stepIndex++;
    if (this.state.stepIndex >= this.state.steps.length) {
      this.state.isComplete = true;
    }
    this.updateStep();
  }
}

customElements.define('loe-player', MissionPlayer);
