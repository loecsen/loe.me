export class BadgesPanel extends HTMLElement {
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
        text-align: center;
      }
      
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
      }
      
      .badge {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        opacity: 0.5;
        filter: grayscale(100%);
        transition: var(--loe-transition);
      }
      
      .badge.unlocked {
        opacity: 1;
        filter: none;
      }
      
      .icon {
        font-size: 40px;
        margin-bottom: 8px;
        filter: drop-shadow(0 0 10px rgba(234, 179, 8, 0.2));
      }
      
      .name {
        font-size: 12px;
        font-weight: 600;
      }
    `;
    this.shadowRoot.appendChild(style);
  }

  render() {
    this.shadowRoot.innerHTML += `
      <h3>🏆 Trophées</h3>
      <div class="grid">
        <div class="badge unlocked">
          <div class="icon">🔥</div>
          <div class="name">7 Jours</div>
        </div>
        <div class="badge unlocked">
          <div class="icon">🚀</div>
          <div class="name">Décollage</div>
        </div>
        <div class="badge">
          <div class="icon">💯</div>
          <div class="name">Perfection</div>
        </div>
        <div class="badge">
          <div class="icon">💬</div>
          <div class="name">Bavard</div>
        </div>
        <div class="badge">
          <div class="icon">🕵️</div>
          <div class="name">Curieux</div>
        </div>
        <div class="badge">
          <div class="icon">🤝</div>
          <div class="name">Ami</div>
        </div>
      </div>
    `;
  }
}

customElements.define('loe-badges', BadgesPanel);
