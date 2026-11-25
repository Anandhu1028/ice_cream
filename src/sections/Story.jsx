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

const HERO1_VISIBLE_THROUGH = 60;
const HERO1_HIDDEN_BY = 61;
const HERO2_VISIBLE_FROM = 100;
const HERO2_VISIBLE_THROUGH = 168;
const HERO3_VISIBLE_FROM = 142;

function computeHero1Opacity(frame) {
  if (frame <= HERO1_VISIBLE_THROUGH) return 1;
  if (frame >= HERO1_HIDDEN_BY) return 0;
  return (HERO1_HIDDEN_BY - frame) / (HERO1_HIDDEN_BY - HERO1_VISIBLE_THROUGH);
}

function computeHero2Opacity(frame) {
  return frame >= HERO2_VISIBLE_FROM && frame <= HERO2_VISIBLE_THROUGH ? 1 : 0;
}

function computeHero3Opacity(frame) {
  return frame >= HERO3_VISIBLE_FROM ? 1 : 0;
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
    const setHero2Opacity = gsap.quickSetter(hero2Ref.current, "opacity");
    const setHero3Opacity = gsap.quickSetter(hero3Ref.current, "opacity");

    gsap.set([hero2Ref.current, hero3Ref.current], { opacity: 0, visibility: "hidden" });
    gsap.set(introRef.current, { opacity: 1, visibility: "visible" });

    let lastHero1Vis = "visible";
    let lastHero2Vis = "hidden";
    let lastHero3Vis = "hidden";

    const syncTextOverlays = (time) => {
      const hero1Frame = frameAtTime(SEQUENCES[0], time);
      const hero2Frame = frameAtTime(SEQUENCES[1], time);
      const hero3Frame = frameAtTime(SEQUENCES[2], time);

      const hero1Opacity = computeHero1Opacity(hero1Frame);
      setIntroOpacity(hero1Opacity);
      const h1Vis = hero1Opacity === 0 ? "hidden" : "visible";
      if (h1Vis !== lastHero1Vis) {
        lastHero1Vis = h1Vis;
        introRef.current.style.visibility = h1Vis;
      }

      const hero2Opacity =
        time >= SEQUENCES[1].start && time <= SEQUENCES[1].start + SEQUENCES[1].duration
          ? computeHero2Opacity(hero2Frame)
          : 0;
      setHero2Opacity(hero2Opacity);
      const h2Vis = hero2Opacity === 0 ? "hidden" : "visible";
      if (h2Vis !== lastHero2Vis) {
        lastHero2Vis = h2Vis;
        hero2Ref.current.style.visibility = h2Vis;
      }

      const hero3Opacity = time >= SEQUENCES[2].start
        ? computeHero3Opacity(hero3Frame)
        : 0;
      setHero3Opacity(hero3Opacity);
      const h3Vis = hero3Opacity === 0 ? "hidden" : "visible";
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
            <p className="hero-intro__label">THE ART OF ICE CREAM</p>
            <h1 className="hero-intro__heading">
              <span className="hero-intro__heading-line">
                <span className="hero-intro__line">A Little Scoop</span>
              </span>
              <span className="hero-intro__heading-line">
                <span className="hero-intro__line">Of Happiness.</span>
              </span>
            </h1>
            <p className="hero-intro__support">
              Discover the joy of creamy flavours, fresh ingredients and
              unforgettable moments.
            </p>
            <a
              className="hero-intro__cta"
              href="#menu"
              onClick={(event) => {
                event.preventDefault();
                navigateToStorySection("menu");
              }}
            >
              Explore Our Flavours
            </a>
          </div>
        </div>
        <div
          className="scene-overlay scene-overlay--chocolate"
          ref={hero2Ref}
          aria-hidden={reduced}
        >
          <div className="scene-overlay__content">
            <p className="scene-overlay__label">A MOMENT OF INDULGENCE</p>
            <h2 className="scene-overlay__heading">
              <span className="scene-overlay__line">Richness in</span>
              <span className="scene-overlay__line">Every Scoop.</span>
            </h2>
            <p className="scene-overlay__support">
              Deep chocolate, silky textures and irresistible moments of pure
              indulgence.
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
