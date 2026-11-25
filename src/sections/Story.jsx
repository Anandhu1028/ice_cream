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
import {
  navigateToStorySection,
  setStorySequenceOrigin,
} from "./storyNavigation";

gsap.registerPlugin(ScrollTrigger, useGSAP);
ScrollTrigger.config({ ignoreMobileResize: true });

const INTRO_REVEAL_DURATION = 2.05;
const INTRO_END_TIME = (SEQUENCES[0].duration * 3) / (FRAME_COUNT - 1);

function computeHero1State(frame) {
  if (frame <= 170) return { opacity: 1, y: 0 };
  if (frame >= 190) return { opacity: 0, y: -28 };
  const progress = (frame - 170) / (190 - 170);
  const ease = progress * progress * (3 - 2 * progress);
  return { opacity: 1 - ease, y: -28 * ease };
}

function computeHero2State(frame) {
  if (frame < 18) return { opacity: 0, y: 28 };
  if (frame < 52) {
    const progress = (frame - 18) / (52 - 18);
    const ease = progress * progress * (3 - 2 * progress);
    return { opacity: ease, y: 28 * (1 - ease) };
  }
  if (frame <= 135) return { opacity: 1, y: 0 };
  if (frame < 172) {
    const progress = (frame - 135) / (172 - 135);
    const ease = progress * progress * (3 - 2 * progress);
    return { opacity: 1 - ease, y: -28 * ease };
  }
  return { opacity: 0, y: -28 };
}

function computeHero3State(frame) {
  if (frame < 18) return { opacity: 0, y: 28 };
  if (frame < 52) {
    const progress = (frame - 18) / (52 - 18);
    const ease = progress * progress * (3 - 2 * progress);
    return { opacity: ease, y: 28 * (1 - ease) };
  }
  if (frame <= 145) return { opacity: 1, y: 0 };
  if (frame < 182) {
    const progress = (frame - 145) / (182 - 145);
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
  const introTimelineRef = useRef(null);
  const hero2Ref = useRef(null);
  const hero3Ref = useRef(null);
  const scrollProgressRef = useRef(0);
  const sequenceOriginRef = useRef(0);
  const introCompleteRef = useRef(false);
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

    sequenceOriginRef.current = 0;
    setStorySequenceOrigin(0, reduced);
    if (reduced) {
      introCompleteRef.current = true;
      return undefined;
    }

    if (!ready) return undefined;

    introCompleteRef.current = false;
    const introFrame = { time: 0 };
    const timeline = gsap.timeline({
      onComplete: () => {
        introTimelineRef.current = null;
        const trigger = ScrollTrigger.getById("scoopy-story");
        const origin = trigger?.progress ?? scrollProgressRef.current;
        sequenceOriginRef.current = origin;
        introCompleteRef.current = true;
        setStorySequenceOrigin(origin);
        player.seek(INTRO_END_TIME);
        onIntroComplete?.();
      },
    });
    introTimelineRef.current = timeline;

    timeline.to(introFrame, {
      time: INTRO_END_TIME,
      duration: INTRO_REVEAL_DURATION,
      ease: "none",
      onUpdate: () => player.seek(introFrame.time),
    }, 0);

    return () => {
      introTimelineRef.current = null;
      timeline.kill();
      introCompleteRef.current = false;
    };
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

    let lastHero1Vis = "visible";
    let lastHero2Vis = "hidden";
    let lastHero3Vis = "hidden";

    const syncTextOverlays = (time) => {
      const hero1Frame = frameAtTime(SEQUENCES[0], time);
      const hero2Frame = frameAtTime(SEQUENCES[1], time);
      const hero3Frame = frameAtTime(SEQUENCES[2], time);

      const h1 = computeHero1State(hero1Frame);
      setIntroOpacity(h1.opacity);
      setIntroY(h1.y);
      const h1Vis = h1.opacity <= 0.005 ? "hidden" : "visible";
      if (h1Vis !== lastHero1Vis) {
        lastHero1Vis = h1Vis;
        introRef.current.style.visibility = h1Vis;
      }

      const inHero2 = time >= SEQUENCES[1].start && time <= SEQUENCES[1].start + SEQUENCES[1].duration;
      const h2 = inHero2 ? computeHero2State(hero2Frame) : { opacity: 0, y: 28 };
      setHero2Opacity(h2.opacity);
      setHero2Y(h2.y);
      const h2Vis = h2.opacity <= 0.005 ? "hidden" : "visible";
      if (h2Vis !== lastHero2Vis) {
        lastHero2Vis = h2Vis;
        hero2Ref.current.style.visibility = h2Vis;
      }

      const inHero3 = time >= SEQUENCES[2].start;
      const h3 = inHero3 ? computeHero3State(hero3Frame) : { opacity: 0, y: 28 };
      setHero3Opacity(h3.opacity);
      setHero3Y(h3.y);
      const h3Vis = h3.opacity <= 0.005 ? "hidden" : "visible";
      if (h3Vis !== lastHero3Vis) {
        lastHero3Vis = h3Vis;
        hero3Ref.current.style.visibility = h3Vis;
      }
    };

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "scoopy-story",
        trigger: rootRef.current,
        start: "top top",
        end: () => (window.innerWidth <= 760 ? "+=420%" : "+=560%"),
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
        const rawProgress = playhead.position;
        scrollProgressRef.current = rawProgress;
        if (!introCompleteRef.current) {
          if (rawProgress <= 0) return;
          introTimelineRef.current?.kill();
          introTimelineRef.current = null;
          introCompleteRef.current = true;
          sequenceOriginRef.current = 0;
          setStorySequenceOrigin(0);
          onIntroComplete?.();
        }

        const origin = sequenceOriginRef.current;
        const progress = origin >= 1
          ? 0
          : Math.max(0, Math.min(1, (rawProgress - origin) / (1 - origin)));
        const time = INTRO_END_TIME + progress * (STORY_DURATION - INTRO_END_TIME);
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
            <img className="hero-intro__poster" src={frameSrc("hero", 1)} alt="" />
          )}
          <IceCreamCanvas />
        </div>
        <div className="hero-intro" ref={introRef}>
          <div className="hero-intro__content">
            <p className="hero-intro__label">THE ART OF ICE CREAM & FALOODA</p>
            <h1 className="hero-intro__heading">
              <span className="hero-intro__heading-line">
                <span className="hero-intro__line">A Little Scoop</span>
              </span>
              <span className="hero-intro__heading-line">
                <span className="hero-intro__line">Of Happiness.</span>
              </span>
            </h1>
            <p className="hero-intro__support">
              Indulge in the luscious richness of our handcrafted strawberry falooda — made with premium creamy milk, fresh strawberries, sweet basil seeds, and velvety ice cream.
            </p>
          </div>
        </div>
        <div
          className="scene-overlay scene-overlay--chocolate"
          ref={hero2Ref}
          aria-hidden={reduced}
        >
          <div className="scene-overlay__content scene-overlay__content--about">
            <p className="scene-overlay__label">OUR HERITAGE & PHILOSOPHY</p>
            <h2 className="scene-overlay__heading scene-overlay__heading--oneline">
              Born From Passion, Crafted With Love.
            </h2>
            <p className="scene-overlay__support">
              Crafted in small batches with farm-fresh dairy and real, seasonal ingredients for
              pure indulgence in every scoop.
            </p>
          </div>
        </div>
        <div
          className="scene-overlay scene-overlay--vanilla"
          ref={hero3Ref}
          aria-hidden={reduced}
        >
          <div className="scene-overlay__content">
            <p className="scene-overlay__label">PURE AND TIMELESS</p>
            <h2 className="scene-overlay__heading">
              <span className="scene-overlay__line">Simply</span>
              <span className="scene-overlay__line">Vanilla.</span>
            </h2>
            <p className="scene-overlay__support">
              A timeless classic, crafted for moments worth savouring.
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
