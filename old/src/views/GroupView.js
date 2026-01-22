import { store } from '../store.js';

export class GroupView extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupStyles();
  }

  setupStyles() {
    const linkElem = document.createElement('link');
    linkElem.setAttribute('rel', 'stylesheet');
    linkElem.setAttribute('href', './src/styles/theme.css');
    this.shadowRoot.appendChild(linkElem);

    const style = document.createElement('style');
    style.textContent = `
      :host {
        display: block;
        padding: 20px;
        color: var(--loe-color-text);
      }
      
      h3 {
        margin-bottom: 24px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .member-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .member {
        display: flex;
        align-items: center;
        background: var(--loe-color-bg-light);
        padding: 12px;
        border-radius: 12px;
        gap: 12px;
      }
      
      .avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #334155;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      }
      
      .info {
        flex: 1;
      }
      
      .name {
        font-weight: 600;
        font-size: 14px;
      }
      
      .status {
        font-size: 12px;
        color: var(--loe-color-text-dim);
      }
      
      .status.done { color: var(--loe-color-success); }
      
      .action-btn {
        background: none;
        border: 1px solid rgba(255,255,255,0.1);
        color: white;
        border-radius: 99px;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: var(--loe-transition);
      }
      
      .action-btn:hover {
        background: rgba(255,255,255,0.1);
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    this.shadowRoot.innerHTML += `
      <h3>👥 Groupe 42</h3>
      <div class="member-list">
        <div class="member">
          <div class="avatar">👨‍💻</div>
          <div class="info">
            <div class="name">Antoine</div>
            <div class="status done">✅ Mission terminée</div>
          </div>
        </div>
        
        <div class="member">
          <div class="avatar">👩‍🚀</div>
          <div class="info">
            <div class="name">Satu</div>
            <div class="status">🕒 En cours...</div>
          </div>
          <button class="action-btn">Encourager</button>
        </div>
        
        <div class="member">
          <div class="avatar">🦊</div>
          <div class="info">
            <div class="name">Vous</div>
            <div class="status">🔥 7 jours</div>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll('.action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        btn.textContent = 'Envoyé !';
        btn.disabled = true;

        // Show Toast
        const toast = document.createElement('loe-poke');
        toast.setAttribute('message', 'Encouragement envoyé ! 💪');
        document.body.appendChild(toast); // Or append to widget shadow root if possible, but body is easier for toast
      });
    });
  }
}

customElements.define('loe-group', GroupView);
