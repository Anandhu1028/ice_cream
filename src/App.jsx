import { useCallback, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import LoadingScreen from "./components/LoadingScreen";
import Story from "./sections/Story";
import Contact from "./sections/Contact";
import "./App.css";

function App() {
  const [active, setActive] = useState("home");
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [filmMissing, setFilmMissing] = useState(false);
  const navigateRef = useRef(() => {});

  const registerNavigate = useCallback((fn) => {
    navigateRef.current = typeof fn === "function" ? fn : () => {};
  }, []);

  const onNavigate = useCallback((id) => {
    navigateRef.current(id);
  }, []);

  const onBootProgress = useCallback((value) => {
    setProgress(value);
  }, []);

  const onBootDone = useCallback((result) => {
    setReady(true);
    setFilmMissing(!result || result.loaded < 1);
  }, []);

  return (
    <>
      <LoadingScreen visible={!ready} progress={progress} />
      <Navbar active={active} onNavigate={onNavigate} />
      <main>
        <Story
          onActive={setActive}
          onBootProgress={onBootProgress}
          onBootDone={onBootDone}
          registerNavigate={registerNavigate}
          filmMissing={filmMissing}
          ready={ready}
        />
        <Contact onNavigate={onNavigate} />
      </main>
    </>
  );
}

export default App;
