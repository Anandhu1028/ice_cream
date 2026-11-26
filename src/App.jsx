import { useCallback, useEffect, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import LoadingScreen from "./components/LoadingScreen";
import Story from "./sections/Story";
import Menu from "./sections/Menu";
import Contact from "./sections/Contact";
import {
  getStoryNavigationState,
  navigateToStorySection,
} from "./sections/storyNavigation";
import "./App.css";

function App() {
  const [ready, setReady] = useState(false);
  const [frameProgress, setFrameProgress] = useState(0);
  const [framesReady, setFramesReady] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const loaderStartedAtRef = useRef(null);
  const [navState, setNavState] = useState({
    active: "home",
    theme: "light",
    background: false,
  });
  const onBootDone = useCallback(() => setFramesReady(true), []);
  const onBootProgress = useCallback((progress) => {
    setFrameProgress(progress);
  }, []);
  const onLogoReady = useCallback(() => setLogoReady(true), []);
  const onLogoError = useCallback((event) => {
    console.error(`Unable to load preloader logo: ${event.currentTarget.src}`);
    setLogoReady(true);
  }, []);
  const onIntroComplete = useCallback(() => {
    setNavState(getStoryNavigationState());
  }, []);
  const onNavigate = useCallback((id) => navigateToStorySection(id), []);
  const loaderProgress = (frameProgress * 3 + Number(logoReady)) / 4;

  useEffect(() => {
    loaderStartedAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!framesReady || !logoReady) return undefined;
    const introDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : 350;
    const elapsed = Date.now() - loaderStartedAtRef.current;
    const delay = Math.max(0, introDuration - elapsed);
    const timeoutId = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timeoutId);
  }, [framesReady, logoReady]);

  useEffect(() => {
    let raf = 0;
    const updateActive = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const next = getStoryNavigationState();
        setNavState((current) =>
          current.active === next.active &&
          current.theme === next.theme &&
          current.background === next.background
            ? current
            : next
        );
      });
    };

    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive, { passive: true });
    updateActive();

    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ready]);

  return (
    <main>
      <LoadingScreen
        visible={!ready}
        progress={loaderProgress}
        onLogoReady={onLogoReady}
        onLogoError={onLogoError}
      />
      <Navbar
        active={navState.active}
        theme={navState.theme}
        background={navState.background}
        onNavigate={onNavigate}
      />
      <Story
        onBootDone={onBootDone}
        onBootProgress={onBootProgress}
        onIntroComplete={onIntroComplete}
        ready={ready}
      />
      <Menu />
      <Contact onNavigate={onNavigate} />
    </main>
  );
}

export default App;
