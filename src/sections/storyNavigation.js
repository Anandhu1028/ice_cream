import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  FRAME_COUNT,
  SEQUENCES,
  STORY_DURATION,
  frameAtTime,
} from "../hooks/useImageSequence";

const INTRO_END_TIME = (SEQUENCES[0].duration * 3) / (FRAME_COUNT - 1);
const HERO2_TARGET_FRAME = 175;

let sequenceOriginProgress = 0;
let storyIntroComplete = false;
let deferredSection = null;

export function setStorySequenceOrigin(progress, introComplete = true) {
  sequenceOriginProgress = Math.max(0, Math.min(1, progress));
  storyIntroComplete = introComplete;
  if (introComplete && deferredSection) {
    const section = deferredSection;
    deferredSection = null;
    requestAnimationFrame(() => navigateToStorySection(section));
  }
}

function progressForTime(time) {
  if (STORY_DURATION <= INTRO_END_TIME) return 0;
  return Math.max(
    0,
    Math.min(1, (time - INTRO_END_TIME) / (STORY_DURATION - INTRO_END_TIME))
  );
}

function rawProgressForSection(id) {
  if (id === "home") return 0;
  if (id === "about") {
    const scene2 = SEQUENCES[1];
    const targetTime =
      scene2.start + ((HERO2_TARGET_FRAME - 1) / (FRAME_COUNT - 1)) * scene2.duration;
    const progress = progressForTime(targetTime);
    return sequenceOriginProgress + progress * (1 - sequenceOriginProgress);
  }
  return 1;
}

function scrollToTarget(target) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.scrollTo(0, target);
  } else {
    window.scrollTo({ top: target, behavior: "smooth" });
  }
}

export function navigateToStorySection(id) {
  if (!storyIntroComplete) {
    deferredSection = id;
    return;
  }

  if (id === "menu" || id === "contact") {
    const sectionEl = document.getElementById(id);
    if (sectionEl) {
      const target = Math.max(0, window.scrollY + sectionEl.getBoundingClientRect().top);
      scrollToTarget(target);
      return;
    }
  }

  const trigger = ScrollTrigger.getById("scoopy-story");
  let target;

  if (trigger) {
    const rawProgress = rawProgressForSection(id);
    target = trigger.start + (trigger.end - trigger.start) * rawProgress;
  } else {
    const stillScenes = document.querySelectorAll(".still-scene");
    if (stillScenes.length) {
      if (id === "home") {
        const intro = document.querySelector(".story-sticky");
        target = intro ? window.scrollY + intro.getBoundingClientRect().top : 0;
      } else {
        const scene = stillScenes[1];
        target = scene ? window.scrollY + scene.getBoundingClientRect().top : 0;
      }
    } else {
      const story = document.querySelector(".story-sticky");
      const start = story ? window.scrollY + story.getBoundingClientRect().top : 0;
      const multiplier = window.innerWidth <= 760 ? 4.2 : 5.6;
      target = start + window.innerHeight * multiplier * rawProgressForSection(id);
    }
  }

  scrollToTarget(target);
}

function isContactReached() {
  const contactEl = document.getElementById("contact");
  if (!contactEl) return false;
  const rect = contactEl.getBoundingClientRect();
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll > 0 && window.scrollY >= maxScroll - 4) return true;
  return rect.top <= window.innerHeight * 0.45;
}

function isMenuReached() {
  const menuEl = document.getElementById("menu");
  return Boolean(menuEl && menuEl.getBoundingClientRect().top <= window.innerHeight * 0.45);
}

export function getStoryNavigationState() {
  const trigger = ScrollTrigger.getById("scoopy-story");
  if (trigger && trigger.end > trigger.start) {
    if (!storyIntroComplete) {
      return { active: "home", theme: "light", background: false };
    }

    if (window.scrollY > trigger.end) {
      const contactReached = isContactReached();
      return {
        active: contactReached ? "contact" : "menu",
        theme: "light",
        background: contactReached || isMenuReached(),
      };
    }

    const rawProgress = Math.max(
      0,
      Math.min(1, (window.scrollY - trigger.start) / (trigger.end - trigger.start))
    );
    const progress =
      sequenceOriginProgress >= 1
        ? 0
        : Math.max(
            0,
            Math.min(1, (rawProgress - sequenceOriginProgress) / (1 - sequenceOriginProgress))
          );
    const time = INTRO_END_TIME + progress * (STORY_DURATION - INTRO_END_TIME);

    const hero3Frame = time >= SEQUENCES[2].start ? frameAtTime(SEQUENCES[2], time) : 0;
    const hero2Frame = time >= SEQUENCES[1].start ? frameAtTime(SEQUENCES[1], time) : 0;

    let active = "home";
    if (hero3Frame >= 142) {
      active = "menu";
    } else if (hero2Frame >= 100) {
      active = "about";
    }

    const isDarkBackdrop =
      time >= SEQUENCES[1].start + 0.06 && time < SEQUENCES[2].start + 0.06;

    return { active, theme: isDarkBackdrop ? "dark" : "light", background: false };
  }

  if (isContactReached()) {
    return { active: "contact", theme: "light", background: true };
  }

  if (isMenuReached()) {
    return { active: "menu", theme: "light", background: true };
  }

  const stillScenes = [...document.querySelectorAll(".still-scene")];
  if (stillScenes.length) {
    const center = window.innerHeight / 2;
    const index = stillScenes.findIndex((scene) => {
      const rect = scene.getBoundingClientRect();
      return rect.top <= center && rect.bottom > center;
    });
    const active = ["home", "about", "menu"][Math.max(0, index)] || "home";
    return { active, theme: active === "about" ? "dark" : "light", background: false };
  }

  return { active: "home", theme: "light", background: false };
}

export function getActiveStorySection() {
  return getStoryNavigationState().active;
}
