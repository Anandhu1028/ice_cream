import { useEffect, useState } from "react";

const LINKS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "menu", label: "Menu" },
  { id: "contact", label: "Contact" },
];

export default function Navbar({ active, onNavigate }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (id) => {
    setOpen(false);
    onNavigate(id);
  };

  return (
    <header className="navbar">
      <a
        href="#home"
        className="logo"
        aria-label="SCOOPY home"
        onClick={(event) => {
          event.preventDefault();
          go("home");
        }}
      >
        <img src="/logo/logo.png" alt="" />
      </a>

      <button
        type="button"
        className={`nav-toggle ${open ? "is-open" : ""}`}
        aria-expanded={open}
        aria-controls="site-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span />
        <span />
        <span />
      </button>

      <nav id="site-nav" className={`nav-links ${open ? "open" : ""}`}>
        {LINKS.map((link) => (
          <a
            key={link.id}
            href={`#${link.id}`}
            className={active === link.id ? "active" : ""}
            aria-current={active === link.id ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              go(link.id);
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>

      <a
        href="#menu"
        className="nav-button"
        onClick={(event) => {
          event.preventDefault();
          go("menu");
        }}
      >
        Explore Flavours <span>↗</span>
      </a>
    </header>
  );
}
