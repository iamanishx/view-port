import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import './App.css'

const STORAGE_KEY = "view-port";

function App() {
  const [initialData, setInitialData] = useState<unknown | undefined>(undefined);
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      try {
        const data = JSON.parse(s);
        setInitialData(data);
      } catch (e) {
        console.warn("Failed to parse saved Excalidraw scene:", e);
      }
    }
  }, []);

  const scheduleSave = useCallback((scene: unknown) => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
      } catch (e) {
        console.warn("Failed to save Excalidraw scene:", e);
      }
      saveTimeoutRef.current = null;
    }, 1000) as unknown as number;
  }, []);

  return (
    <div className="app-container">
      <h1>Excalidraw Example</h1>
      <div className="excalidraw-wrapper">
        <Excalidraw
          initialData={initialData as any}
          onChange={(elements, state) => {
            scheduleSave({ elements, state });
          }}
        />
      </div>
    </div>
  )
}

export default App
