const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com" },
  { label: "Pinterest", href: "https://pinterest.com" },
  { label: "Facebook", href: "https://facebook.com" },
];

export default function Contact({ onNavigate }) {
  return (
    <section className="contact-section" id="contact">
      <div className="contact-intro">
        <span className="eyebrow">SAY HELLO</span>
        <h2>LET&apos;S MAKE LIFE SWEETER.</h2>
        <p>
          We would love to hear from you. The details on this page
          are sample placeholders for the SCOOPY preview.
        </p>
        <a className="contact-mail" href="mailto:hello@example.com">
          hello@example.com
        </a>
      </div>

      <div className="contact-panel">
        <dl>
          <div>
            <dt>Address</dt>
            <dd>00 Pinkberry Street, Suite 1, Your City</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>+00 0000 000 000</dd>
          </div>
          <div>
            <dt>Opening hours</dt>
            <dd>Open daily, 11:00 – 23:00</dd>
          </div>
        </dl>

        <div className="social-row">
          {SOCIALS.map((social) => (
            <a key={social.label} href={social.href} target="_blank" rel="noreferrer">
              {social.label}
            </a>
          ))}
        </div>
      </div>

      <footer className="footer">
        <a
          href="#home"
          className="logo"
          onClick={(event) => {
            event.preventDefault();
            onNavigate?.("home");
          }}
        >
          SCOOPY<span>.</span>
        </a>
        <p>A little scoop of happiness in every bite.</p>
        <small>© {new Date().getFullYear()} SCOOPY. A sweet preview, not a real shop.</small>
      </footer>
    </section>
  );
}
