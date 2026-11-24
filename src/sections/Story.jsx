import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useGSAP } from "@gsap/react";
import IceCreamCanvas from "../components/IceCreamCanvas";
import Home from "./Home";
import About from "./About";
import Menu from "./Menu";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { POSTERS, TOTAL_FRAMES, getSequencePlayer } from "../hooks/useImageSequence";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, useGSAP);
ScrollTrigger.config({ ignoreMobileResize: true });

const STOPS = { home: 0, about: 0.42, menu: 0.78 };

function sectionForProgress(progress) {
  if (progress < 0.31) return "home";
  if (progress < 0.64) return "about";
  return "menu";
}

export default function Story({
  onActive,
  onBootProgress,
  onBootDone,
  registerNavigate,
  filmMissing,
  ready,
}) {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef(null);
  const homeRef = useRef(null);
  const aboutRef = useRef(null);
  const menuRef = useRef(null);
  const extraRef = useRef(null);
  const barRef = useRef(null);
  const goRef = useRef(() => {});
  const onActiveRef = useRef(onActive);
  const activeRef = useRef("home");

  useEffect(() => {
    onActiveRef.current = onActive;
  }, [onActive]);

  const report = (id) => {
    if (!id || activeRef.current === id) return;
    activeRef.current = id;
    onActiveRef.current(id);
  };

  useEffect(() => {
    let live = true;
    const player = getSequencePlayer();
    player.preloadCritical((value) => {
      if (live) onBootProgress(value);
    }).then((result) => {
      if (!live) return;
      if (reduced) player.seek(119);
      onBootDone(result);
    });
    return () => {
      live = false;
    };
  }, [onBootDone, onBootProgress, reduced]);

  useEffect(() => {
    if (!reduced) return undefined;

    const go = (section) => {
      const target = document.getElementById(section);
      if (!target) return;
      const top = target.getBoundingClientRect().top + window.scrollY;
      gsap.to(window, {
        scrollTo: Math.max(0, top),
        duration: 0.9,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    };

    goRef.current = go;
    registerNavigate(go);

    const onScroll = () => {
      const line = window.innerHeight * 0.35;
      const order = ["contact", "menu", "about", "home"];
      for (const id of order) {
        const element = document.getElementById(id);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= line && rect.bottom > line) {
          report(id);
          return;
        }
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      registerNavigate(() => {});
    };
  }, [reduced, registerNavigate]);

  useGSAP(() => {
    if (reduced || !ready || !rootRef.current) return undefined;

    const player = getSequencePlayer();
    const about = aboutRef.current;
    const menu = menuRef.current;
    const canvasLayer = rootRef.current.querySelector(".story-canvas");
    const pillars = about.querySelectorAll(".pillar");
    const cards = menu.querySelectorAll(".flavour-card");
    const aboutCopy = about.querySelectorAll(".eyebrow, h2, .about-sheet > p");
    const menuCopy = menu.querySelectorAll(".eyebrow, h2, .menu-note");
    const playhead = { frame: 0 };

    const intro = gsap.timeline({
      defaults: { ease: "power3.out" },
    });
    intro
      .from(homeRef.current.querySelector(".eyebrow"), {
        autoAlpha: 0,
        y: 12,
        duration: 0.6,
      })
      .from(homeRef.current.querySelectorAll(".hero-word"), {
        autoAlpha: 0,
        yPercent: 45,
        duration: 0.75,
        stagger: 0.12,
      }, 0.08)
      .from(homeRef.current.querySelector(".hero-content > p"), {
        autoAlpha: 0,
        y: 16,
        duration: 0.6,
      }, 0.38)
      .from(homeRef.current.querySelector(".hero-buttons"), {
        autoAlpha: 0,
        y: 12,
        duration: 0.55,
      }, 0.52)
      .from(homeRef.current.querySelector(".hero-caption"), {
        autoAlpha: 0,
        y: 8,
        duration: 0.45,
      }, 0.66);

    const sync = (progress) => {
      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`;
      report(sectionForProgress(progress));
    };

    gsap.set(about, { autoAlpha: 0, y: 36 });
    gsap.set(menu, { autoAlpha: 0, y: 36 });
    gsap.set(aboutCopy, { autoAlpha: 0, y: 12 });
    gsap.set(menuCopy, { autoAlpha: 0, y: 12 });
    gsap.set(pillars, { autoAlpha: 0, y: 18 });
    gsap.set(cards, { autoAlpha: 0, y: 14 });

    const timeline = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        id: "scoopy-story",
        trigger: rootRef.current,
        start: "top top",
        end: "+=480%",
        pin: true,
        scrub: 0.25,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (!self.isActive) return;
          sync(self.progress);
        },
        onLeave: () => report("contact"),
        onLeaveBack: () => report("home"),
        onEnterBack: (self) => sync(self.progress),
      },
    });

    timeline.to(playhead, {
      frame: TOTAL_FRAMES - 1,
      duration: 1,
      onUpdate: () => player.seek(playhead.frame),
    }, 0);

    timeline.to(homeRef.current, {
      autoAlpha: 0,
      y: -28,
      duration: 0.05,
      ease: "power1.inOut",
    }, 0.27);
    timeline.to(extraRef.current, { autoAlpha: 0, duration: 0.04 }, 0.26);

    timeline.to(about, { autoAlpha: 1, y: 0, duration: 0.05, ease: "power1.inOut" }, 0.3);
    timeline.to(aboutCopy, {
      autoAlpha: 1,
      y: 0,
      duration: 0.025,
      stagger: 0.014,
      ease: "power1.out",
    }, 0.32);
    timeline.to(pillars, {
      autoAlpha: 1,
      y: 0,
      duration: 0.04,
      stagger: 0.014,
      ease: "power1.out",
    }, 0.36);
    timeline.to(about, { autoAlpha: 0, y: -28, duration: 0.045, ease: "power1.inOut" }, 0.59);

    timeline.to(menu, { autoAlpha: 1, y: 0, duration: 0.05, ease: "power1.inOut" }, 0.63);
    timeline.to(menuCopy, {
      autoAlpha: 1,
      y: 0,
      duration: 0.025,
      stagger: 0.014,
      ease: "power1.out",
    }, 0.65);
    timeline.to(cards, {
      autoAlpha: 1,
      y: 0,
      duration: 0.04,
      stagger: 0.012,
      ease: "power1.out",
    }, 0.69);
    timeline.to(canvasLayer, {
      autoAlpha: 0.42,
      scale: 1.015,
      duration: 0.06,
      ease: "power1.in",
    }, 0.94);

    const go = (section) => {
      const trigger = timeline.scrollTrigger;
      if (section === "contact") {
        gsap.to(window, {
          scrollTo: { y: "#contact", offsetY: 0 },
          duration: 1.05,
          ease: "power2.inOut",
          overwrite: "auto",
        });
        return;
      }
      const stop = STOPS[section];
      if (!trigger || stop == null) return;
      const y = trigger.start + (trigger.end - trigger.start) * stop;
      gsap.to(window, {
        scrollTo: y,
        duration: 1.05,
        ease: "power2.inOut",
        overwrite: "auto",
      });
    };

    goRef.current = go;
    registerNavigate(go);
    let active = true;
    document.fonts?.ready.then(() => {
      if (active) ScrollTrigger.refresh();
    });

    return () => {
      active = false;
      registerNavigate(() => {});
    };
  }, {
    scope: rootRef,
    dependencies: [reduced, ready, registerNavigate],
    revertOnUpdate: true,
  });

  const openMenu = () => goRef.current("menu");
  const openAbout = () => goRef.current("about");

  if (reduced) {
    return (
      <>
        <section className="home-section" id="home">
          <Home onExplore={openMenu} onStory={openAbout} />
          <div className="hero-visual">
            <img
              src={POSTERS.home}
              alt="Strawberry ice cream cone with fresh berries"
              className="hero-icecream"
            />
            <div className="image-label">
              <span>OUR SIGNATURE</span>
              <strong>Strawberry Dream</strong>
            </div>
          </div>
        </section>

        <section className="flow-section" id="about">
          <About />
          <img src={POSTERS.about} alt="Strawberry cone beside vanilla and chocolate scoops" />
        </section>

        <section className="flow-section menu-flow" id="menu">
          <Menu />
          <img src={POSTERS.menu} alt="Strawberry, vanilla and chocolate scoops on a pink splash" />
        </section>
      </>
    );
  }

  return (
    <section className="story-sticky" id="story" ref={rootRef} aria-label="Scoopy scroll film">
      <div className="story-progress" aria-hidden="true">
        <span ref={barRef} />
      </div>

      <div className="story-canvas" role="img" aria-label="Scroll-driven strawberry ice cream film">
        <IceCreamCanvas />
        {filmMissing && (
          <p className="film-warning">
            The ice cream film could not be loaded. Refresh to try the frames again.
          </p>
        )}
      </div>

      <div className="story-layers">
        <div className="story-copy home-layer" id="home" ref={homeRef}>
          <Home onExplore={openMenu} onStory={openAbout} />
        </div>
        <div className="story-copy about-layer" id="about" ref={aboutRef}>
          <About />
        </div>
        <div className="story-copy menu-layer" id="menu" ref={menuRef}>
          <Menu />
        </div>
      </div>

      <div className="home-extra" ref={extraRef}>
        <div className="image-label">
          <span>OUR SIGNATURE</span>
          <strong>Strawberry Dream</strong>
        </div>
        <div className="scroll-indicator">
          <span>SCROLL TO DISCOVER</span>
          <span className="scroll-arrow">↓</span>
        </div>
      </div>
    </section>
  );
}
