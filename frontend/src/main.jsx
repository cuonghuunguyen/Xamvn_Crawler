import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SplashScreen from './components/SplashScreen.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SplashScreen>
      <App />
    </SplashScreen>
  </StrictMode>,
)
