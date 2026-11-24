const PILLARS = [
  {
    index: "01",
    title: "Our Story",
    copy: "Born from slow afternoons, ripe berries and the pleasure of sharing a cone.",
  },
  {
    index: "02",
    title: "Fresh Ingredients",
    copy: "Cream, fruit and cocoa chosen for flavour — picked with care, used while they are bright.",
  },
  {
    index: "03",
    title: "Crafted With Love",
    copy: "Small batches, spun by hand and finished while the scoop is still soft.",
  },
];

export default function About() {
  return (
    <div className="story-sheet about-sheet">
      <span className="eyebrow">OUR STORY</span>
      <h2>A LITTLE SCOOP OF HAPPINESS.</h2>
      <p>
        Every scoop tells a story of freshness, flavour
        and happiness. We create delightful ice cream
        experiences using carefully selected ingredients.
      </p>
      <ul className="pillars">
        {PILLARS.map((pillar) => (
          <li className="pillar" key={pillar.title}>
            <span>{pillar.index}</span>
            <div>
              <strong>{pillar.title}</strong>
              <p>{pillar.copy}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
