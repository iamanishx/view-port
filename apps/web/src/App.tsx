import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import './App.css'

function App() {
  return (
    <div className="app-container">
      <h1>Excalidraw Example</h1>
      <div className="excalidraw-wrapper">
        <Excalidraw />
      </div>
    </div>
  )
}

export default App
