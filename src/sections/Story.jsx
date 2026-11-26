import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import IceCreamCanvas from "../components/IceCreamCanvas";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import {
  FRAME_COUNT,
  POSTERS,
  SEQUENCES,
  STORY_DURATION,
  frameAtTime,
  frameSrc,
  getSequencePlayer,
} from "../hooks/useImageSequence";
import { setStorySequenceOrigin } from "./storyNavigation";

gsap.registerPlugin(ScrollTrigger, useGSAP);
ScrollTrigger.config({ ignoreMobileResize: true });

const INTRO_END_TIME = 0;

function computeHero1State(frame) {
  if (frame <= 170) return { opacity: 1, y: 0 };
  if (frame >= 190) return { opacity: 0, y: -28 };
  const progress = (frame - 170) / (190 - 170);
  const ease = progress * progress * (3 - 2 * progress);
  return { opacity: 1 - ease, y: -28 * ease };
}

function computeHero2State(frame) {
  if (frame < 100) return { opacity: 0, y: 28 };
  if (frame < 118) {
    const progress = (frame - 100) / (118 - 100);
    const ease = progress * progress * (3 - 2 * progress);
    return { opacity: ease, y: 28 * (1 - ease) };
  }
  if (frame <= 172) return { opacity: 1, y: 0 };
  if (frame < 190) {
    const progress = (frame - 172) / (190 - 172);
    const ease = progress * progress * (3 - 2 * progress);
    return { opacity: 1 - ease, y: -28 * ease };
  }
  return { opacity: 0, y: -28 };
}

function computeHero3State(frame) {
  if (frame < 110) return { opacity: 0, y: 28 };
  if (frame < 126) {
    const progress = (frame - 110) / (126 - 110);
    const ease = progress * progress * (3 - 2 * progress);
    return { opacity: ease, y: 28 * (1 - ease) };
  }
  if (frame <= 172) return { opacity: 1, y: 0 };
  if (frame < 190) {
    const progress = (frame - 172) / (190 - 172);
    const ease = progress * progress * (3 - 2 * progress);
    return { opacity: 1 - ease, y: -28 * ease };
  }
  return { opacity: 0, y: -28 };
}

export default function Story({
  onBootDone,
  onBootProgress,
  onIntroComplete,
  ready,
}) {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef(null);
  const introRef = useRef(null);
  const hero2Ref = useRef(null);
  const hero3Ref = useRef(null);
  const finaleScene = SEQUENCES[SEQUENCES.length - 1];

  useEffect(() => {
    let live = true;
    getSequencePlayer().preloadCritical(onBootProgress).then(() => {
      if (live) onBootDone();
    });
    return () => {
      live = false;
    };
  }, [onBootDone, onBootProgress]);

  useGSAP(() => {
    const player = getSequencePlayer();

    if (reduced) {
      setStorySequenceOrigin(0, true);
      return undefined;
    }

    if (!ready) {
      setStorySequenceOrigin(0, false);
      return undefined;
    }

    setStorySequenceOrigin(0, true);
    player.seek(INTRO_END_TIME);
    onIntroComplete?.();
    return undefined;
  }, {
    scope: rootRef,
    dependencies: [reduced, ready, onIntroComplete],
    revertOnUpdate: true,
  });

  useGSAP(() => {
    if (reduced || !ready || !rootRef.current) return undefined;

    const player = getSequencePlayer();
    const playhead = { position: 0 };
    const setIntroOpacity = gsap.quickSetter(introRef.current, "opacity");
    const setIntroY = gsap.quickSetter(introRef.current, "y", "px");
    const setHero2Opacity = gsap.quickSetter(hero2Ref.current, "opacity");
    const setHero2Y = gsap.quickSetter(hero2Ref.current, "y", "px");
    const setHero3Opacity = gsap.quickSetter(hero3Ref.current, "opacity");
    const setHero3Y = gsap.quickSetter(hero3Ref.current, "y", "px");

    gsap.set([hero2Ref.current, hero3Ref.current], { opacity: 0, y: 28, visibility: "hidden" });
    gsap.set(introRef.current, { opacity: 1, y: 0, visibility: "visible" });

    const lastOverlay = {
      h1: { opacity: 1, y: 0, vis: "visible" },
      h2: { opacity: 0, y: 28, vis: "hidden" },
      h3: { opacity: 0, y: 28, vis: "hidden" },
    };

    const applyOverlay = (el, prev, next, setOpacity, setY) => {
      const opacity = Math.round(next.opacity * 1000) / 1000;
      const y = Math.round(next.y * 10) / 10;
      const vis = opacity <= 0.005 ? "hidden" : "visible";
      if (opacity !== prev.opacity) {
        prev.opacity = opacity;
        setOpacity(opacity);
      }
      if (y !== prev.y) {
        prev.y = y;
        setY(y);
      }
      if (vis !== prev.vis) {
        prev.vis = vis;
        el.style.visibility = vis;
      }
    };

    const syncTextOverlays = (time) => {
      const hero1Frame = frameAtTime(SEQUENCES[0], time);
      const hero2Frame = frameAtTime(SEQUENCES[1], time);
      const hero3Frame = frameAtTime(SEQUENCES[2], time);

      applyOverlay(introRef.current, lastOverlay.h1, computeHero1State(hero1Frame), setIntroOpacity, setIntroY);

      const inHero2 = time >= SEQUENCES[1].start && time <= SEQUENCES[1].start + SEQUENCES[1].duration;
      applyOverlay(
        hero2Ref.current,
        lastOverlay.h2,
        inHero2 ? computeHero2State(hero2Frame) : { opacity: 0, y: 28 },
        setHero2Opacity,
        setHero2Y
      );

      const inHero3 = time >= SEQUENCES[2].start;
      applyOverlay(
        hero3Ref.current,
        lastOverlay.h3,
        inHero3 ? computeHero3State(hero3Frame) : { opacity: 0, y: 28 },
        setHero3Opacity,
        setHero3Y
      );
    };

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "scoopy-story",
        trigger: rootRef.current,
        start: "top top",
        end: () => (window.innerWidth <= 760 ? "+=280%" : "+=360%"),
        pin: true,
        scrub: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    timeline.to(playhead, {
      position: 1,
      duration: STORY_DURATION,
      onUpdate: () => {
        const time = playhead.position * STORY_DURATION;
        player.seek(time);
        syncTextOverlays(time);
      },
    }, 0);

    let active = true;
    let resizeTimer = 0;
    let previousWidth = window.innerWidth;
    const refreshAtNewWidth = () => {
      if (window.innerWidth === previousWidth) return;
      previousWidth = window.innerWidth;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (active) ScrollTrigger.refresh();
      }, 150);
    };
    window.addEventListener("resize", refreshAtNewWidth, { passive: true });

    return () => {
      active = false;
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", refreshAtNewWidth);
    };
  }, {
    scope: rootRef,
    dependencies: [reduced, ready, onIntroComplete],
    revertOnUpdate: true,
  });

  return (
    <>
      <section className={`story-sticky${reduced ? " is-reduced" : ""}`} ref={rootRef}>
        <div className="story-canvas" aria-hidden="true">
          {reduced && (
            <img className="hero-intro__poster" src={frameSrc("hero", SEQUENCES[0].startFrame ?? 1)} alt="" />
          )}
          <IceCreamCanvas />
        </div>
        <div className="hero-intro" ref={introRef}>
          <div className="hero-intro__content">
            <p className="hero-intro__label">THE ART OF RED VELVET</p>
            <h1 className="hero-intro__heading">
              <span className="hero-intro__heading-line">
                <span className="hero-intro__line">Layers Of</span>
              </span>
              <span className="hero-intro__heading-line">
                <span className="hero-intro__line">Pure Velvet.</span>
              </span>
            </h1>
            <p className="hero-intro__support">
              Three tender red velvet sponge layers stacked with velvety cream cheese frosting — baked fresh for effortless indulgence.
            </p>
          </div>
        </div>
        <div
          className="scene-overlay scene-overlay--chocolate"
          ref={hero2Ref}
          aria-hidden={reduced}
        >
          <div className="scene-overlay__content scene-overlay__content--about">
            <p className="scene-overlay__label">OUR HERITAGE & CRAFT</p>
            <h2 className="scene-overlay__heading scene-overlay__heading--oneline">
              Born From Passion, Crafted With Love.
            </h2>
            <p className="scene-overlay__support">
              Enrobed in whipped ivory cream frosting and finished with delicate red velvet crumbs for a rich, melt-in-the-mouth texture.
            </p>
          </div>
        </div>
        <div
          className="scene-overlay scene-overlay--vanilla"
          ref={hero3Ref}
          aria-hidden={reduced}
        >
          <div className="scene-overlay__content">
            <p className="scene-overlay__label">FINISHED TO PERFECTION</p>
            <h2 className="scene-overlay__heading">
              <span className="scene-overlay__line">Ganache &amp;</span>
              <span className="scene-overlay__line">Berries.</span>
            </h2>
            <p className="scene-overlay__support">
              Crowned with glossy dark chocolate ganache and hand-picked fresh berries — a timeless centerpiece worth savouring.
            </p>
          </div>
        </div>
      </section>
      {reduced ? (
        <div className="still-film" aria-hidden="true">
          {SEQUENCES.map((scene) => (
            <section
              className="still-scene"
              key={scene.id}
              style={{ backgroundColor: scene.background }}
            >
              <img
                src={POSTERS[scene.id]}
                alt=""
                style={{ objectPosition: `${scene.focalX * 100}% center` }}
              />
            </section>
          ))}
        </div>
      ) : (
        <div className="film-finale" aria-hidden="true">
          <img
            src={frameSrc(finaleScene.folder, FRAME_COUNT)}
            alt=""
            style={{ objectPosition: `${finaleScene.focalX * 100}% center` }}
          />
        </div>
      )}
    </>
  );
}
