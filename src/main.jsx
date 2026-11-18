import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import './v2.css'

// Look: 'v2' (default) or 'v1' (classic). Set before render so the page doesn't flash.
let ui = 'v2'
try { ui = localStorage.getItem('ui') ?? 'v2' } catch { /* storage blocked: use default */ }
document.documentElement.dataset.ui = ui

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
