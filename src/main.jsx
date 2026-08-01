import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// import AppleMusicBar from './App.jsx'
import FloatingBar from './components/FluidGlass'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div>
      <FloatingBar />

    </div>

  </StrictMode>,
)
