export default function Home({ onExplore, onStory }) {
  return (
    <div className="hero-content">
      <span className="eyebrow">✦ MADE WITH LOVE & FRESHNESS</span>

      <h1 aria-label="SCOOP UP HAPPINESS!">
        <span className="hero-heading-line">
          <span className="hero-word">SCOOP</span>{" "}
          <span className="hero-word">UP</span>
        </span>
        <span className="hero-heading-line hero-heading-highlight">
          <span className="hero-word">HAPPINESS!</span>
        </span>
      </h1>

      <p>
        A little scoop of happiness in every bite.
        Discover our delicious world of creamy, dreamy
        and irresistible ice creams.
      </p>

      <div className="hero-buttons">
        <a
          href="#menu"
          className="primary-btn"
          onClick={(event) => {
            event.preventDefault();
            onExplore?.();
          }}
        >
          Explore Flavours <span>↗</span>
        </a>

        <a
          href="#about"
          className="secondary-btn"
          onClick={(event) => {
            event.preventDefault();
            onStory?.();
          }}
        >
          Our Story
        </a>
      </div>

      <div className="hero-caption">
        <span>01</span>
        <span className="caption-line" />
        <span>THE SWEETEST EXPERIENCE</span>
      </div>
    </div>
  );
}
