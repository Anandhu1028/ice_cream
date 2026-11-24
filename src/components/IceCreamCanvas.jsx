import { useRef } from "react";
import { useImageSequence } from "../hooks/useImageSequence";

export default function IceCreamCanvas() {
  const canvasRef = useRef(null);
  useImageSequence(canvasRef, true);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}
