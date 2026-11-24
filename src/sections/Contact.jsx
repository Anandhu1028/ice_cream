export default function Contact({ onNavigate }) {
  const handleEnquirySubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const body = [
      `Name: ${formData.get("name")}`,
      `Email: ${formData.get("email")}`,
      "",
      formData.get("message"),
    ].join("\n");
    const query = new URLSearchParams({
      subject: "SCOOPY enquiry",
      body,
    });

    window.location.href = `mailto:hello@example.com?${query.toString()}`;
  };

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
        <dl className="contact-details">
          <div>
            <dt>Contact</dt>
            <dd>+00 0000 000 000</dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>00 Pinkberry Street, Suite 1, Your City</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>Open daily, 11:00 – 23:00</dd>
          </div>
        </dl>
      </div>

      <form className="contact-form" onSubmit={handleEnquirySubmit}>
        <span className="eyebrow">ENQUIRIES</span>
        <h3>Send us a sweet note.</h3>
        <div className="contact-form__fields">
          <label>
            Your name
            <input autoComplete="name" name="name" required />
          </label>
          <label>
            Email address
            <input
              autoComplete="email"
              name="email"
              type="email"
              required
            />
          </label>
          <label>
            Message
            <textarea name="message" rows="4" required />
          </label>
        </div>
        <button className="contact-form__submit" type="submit">
          Send enquiry
        </button>
      </form>

      <footer className="footer">
        <a
          href="#home"
          className="logo"
          aria-label="SCOOPY home"
          onClick={(event) => {
            event.preventDefault();
            onNavigate?.("home");
          }}
        >
          <img src="/logo/logo.png" alt="" />
        </a>
        <p>A little scoop of happiness in every bite.</p>
        <small>© {new Date().getFullYear()} SCOOPY. A sweet preview, not a real shop.</small>
      </footer>
    </section>
  );
}
