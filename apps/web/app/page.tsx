import { Pill, Surface } from '@loe/ui';

export default function HomePage() {
  return (
    <section className="hero">
      <Pill>Mission Engine V1</Pill>
      <h1>Un socle calme et premium pour vos missions Loe.me.</h1>
      <p>
        Une base légère pour orchestrer les parcours, les intentions et les rituels. Le backend
        arrivera plus tard ; ici on pose le cadre visuel et les fondations du domaine.
      </p>
      <Surface>
        <div className="hero-grid">
          <div className="hero-card">
            <h3>Blueprints</h3>
            <p>Structure des missions et jalons clés, prêt pour l’implémentation.</p>
          </div>
          <div className="hero-card">
            <h3>UI calme</h3>
            <p>Blanc lumineux, accents pastel et composants arrondis.</p>
          </div>
          <div className="hero-card">
            <h3>Monorepo</h3>
            <p>App Next.js + packages partagés pour évoluer sereinement.</p>
          </div>
        </div>
      </Surface>
    </section>
  );
}
