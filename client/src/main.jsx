import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRouter from './AppRouter.jsx'

// Punkt wejścia aplikacji — montujemy AppRouter w elemencie #root z index.html
// StrictMode włącza dodatkowe ostrzeżenia w trybie deweloperskim
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppRouter />
  </StrictMode>,
)
