import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { publicAsset } from "../utils/publicAsset";

gsap.registerPlugin(useGSAP);

export default function LoadingScreen({
  visible,
  progress,
  onLogoReady,
  onLogoError,
}) {
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef(null);
  const logoRef = useRef(null);
  const taglineRef = useRef(null);
  const progressRef = useRef(null);
  const amount = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  useGSAP(
    () => {
      if (reducedMotion) {
        gsap.set(
          [logoRef.current, taglineRef.current, progressRef.current],
          { clearProps: "all" }
        );
        if (!visible) gsap.set(rootRef.current, { autoAlpha: 0 });
        return undefined;
      }

      if (visible) {
        const intro = gsap.timeline();
        intro
          .fromTo(
            logoRef.current,
            { autoAlpha: 0, scale: 0.985 },
            { autoAlpha: 1, scale: 1, duration: 0.8, ease: "power2.out" }
          )
          .fromTo(
            taglineRef.current,
            { autoAlpha: 0, y: 8 },
            { autoAlpha: 1, y: 0, duration: 0.55, ease: "power2.out" },
            "-=0.35"
          )
          .fromTo(
            progressRef.current,
            { autoAlpha: 0, y: 4 },
            { autoAlpha: 1, y: 0, duration: 0.4, ease: "power1.out" },
            "-=0.2"
          );
        return () => intro.kill();
      }

      const exit = gsap.timeline();
      exit
        .to(
          [taglineRef.current, progressRef.current],
          { autoAlpha: 0, duration: 0.2, stagger: 0.04, ease: "power1.in" }
        )
        .to(
          logoRef.current,
          { autoAlpha: 0, scale: 0.99, duration: 0.45, ease: "power2.in" },
          "-=0.05"
        )
        .to(
          rootRef.current,
          { autoAlpha: 0, duration: 0.5, ease: "power1.inOut" },
          "-=0.1"
        );
      return () => exit.kill();
    },
    {
      scope: rootRef,
      dependencies: [visible, reducedMotion],
      revertOnUpdate: true,
    }
  );

  return (
    <div
      ref={rootRef}
      className={`loader ${visible ? "" : "is-done"}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className="loader-card">
        <img
          ref={logoRef}
          className="loader-logo"
          src={publicAsset("logo/logo.png")}
          alt="SCOOPY"
          onLoad={onLogoReady}
          onError={onLogoError}
        />
        <p ref={taglineRef} className="loader-tagline">
          Made with love. Served with happiness.
        </p>
        <div ref={progressRef} className="loader-progress-group">
          <div
            className="loader-bar"
            role="progressbar"
            aria-label="Loading the first hero scene"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={amount}
          >
            <span style={{ width: `${amount}%` }} />
          </div>
          <p className="loader-percent">{amount}%</p>
        </div>
      </div>
    </div>
  );
}
