const FLAVOURS = [
  {
    name: "Strawberry",
    copy: "Sun-ripe berries folded through silky pink cream.",
    swatch: "linear-gradient(145deg, #ffd0dc, #e77995)",
  },
  {
    name: "Chocolate",
    copy: "Deep cocoa with a slow, glossy finish.",
    swatch: "linear-gradient(145deg, #8a5a48, #4a2c24)",
  },
  {
    name: "Mango",
    copy: "Ripe mango, bright and lush on the spoon.",
    swatch: "linear-gradient(145deg, #ffd59a, #ef9a3a)",
  },
  {
    name: "Vanilla",
    copy: "Classic bean vanilla, soft and unhurried.",
    swatch: "linear-gradient(145deg, #fff6e8, #f0ddc0)",
  },
  {
    name: "Pistachio",
    copy: "Toasted nuts and a gentle green sweetness.",
    swatch: "linear-gradient(145deg, #d5e2b8, #7f9a62)",
  },
];

export default function Menu() {
  return (
    <div className="story-sheet menu-sheet">
      <span className="eyebrow">OUR FLAVOURS</span>
      <h2>FIND YOUR HAPPY FLAVOUR.</h2>
      <p className="menu-note">
        The scrolling film is one strawberry story, from the first cone
        to the last scoop. These five flavours are served at the counter.
      </p>
      <ul className="flavour-list">
        {FLAVOURS.map((flavour) => (
          <li className="flavour-card" key={flavour.name}>
            <span className="flavour-swatch" style={{ background: flavour.swatch }} />
            <div className="flavour-copy">
              <strong>{flavour.name}</strong>
              <p>{flavour.copy}</p>
            </div>
            <div className="flavour-price">
              <span>Price</span>
              <strong>₹ —</strong>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
