import { useEffect } from 'react'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import BackToTop from './components/BackToTop.jsx'
import Chatbot from './components/Chatbot.jsx'
import Home from './pages/Home.jsx'
import Alerts from './pages/Alerts.jsx'
import Inspect from './pages/Inspect.jsx'
import Relief from './pages/Relief.jsx'

function App() {
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [])

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#121212] [font-family:Inter,Arial,Helvetica,sans-serif]">
      <Navbar />
      <main>
        <Home />
        <Alerts />
        <Inspect />
        <Relief />
      </main>
      <Footer />
      <BackToTop />
      <Chatbot />
    </div>
  )
}

export default App
