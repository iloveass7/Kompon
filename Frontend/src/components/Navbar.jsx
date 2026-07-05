import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { scrollToSectionStart } from '../lib/scroll.js'
import { type } from '../lib/typography.js'

const navItems = [
  { label: 'Home', target: 'home' },
  { label: 'Alerts', target: 'alerts' },
  { label: 'Inspect', target: 'inspect' },
  { label: 'Relief', target: 'relief' },
]

function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [solid, setSolid] = useState(false)

  // Transparent while sitting over the dark hero image; solid once scrolled past it.
  useEffect(() => {
    const updateSolid = () => {
      const hero = document.getElementById('hero')
      const threshold = hero ? hero.offsetHeight - 80 : 480
      setSolid(window.scrollY > threshold)
    }

    updateSolid()
    window.addEventListener('scroll', updateSolid, { passive: true })
    window.addEventListener('resize', updateSolid)
    return () => {
      window.removeEventListener('scroll', updateSolid)
      window.removeEventListener('resize', updateSolid)
    }
  }, [])

  const scrollToSection = (event, target) => {
    event.preventDefault()
    setIsOpen(false)
    scrollToSectionStart(target)
  }

  const callEmergency = () => {
    setIsOpen(false)
    window.location.href = 'tel:999'
  }

  // On the dark hero, text is light; once solid, revert to the dark-on-light scheme.
  const overHero = !solid && !isOpen
  const navTextClass = overHero ? 'text-white' : 'text-[#121212]'

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex min-h-[100px] items-center justify-between px-5 transition-colors duration-300 ease-out sm:px-8 md:px-10 lg:px-16 xl:px-20 ${
        solid || isOpen
          ? 'border-b border-[#ddd] bg-[#fafafa]/95 text-[#121212] backdrop-blur'
          : 'border-b border-transparent bg-transparent text-white'
      }`}
    >
      <a
        className={`relative z-10 inline-flex min-h-8 items-center gap-2.5 transition-colors duration-300 ease-out ${type.navBrand} ${navTextClass}`}
        href="#home"
        onClick={(event) => scrollToSection(event, 'home')}
      >
        <span className="relative inline-block h-16 w-16 shrink-0 sm:h-16 sm:w-16">
          <img
            src="/kompon_light.png"
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ease-out ${
              overHero ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <img
            src="/kompon.png"
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ease-out ${
              overHero ? 'opacity-0' : 'opacity-100'
            }`}
          />
        </span>
        Kompon
      </a>

      <button
        className={`relative z-10 inline-flex h-10 w-10 items-center justify-center border border-transparent bg-transparent transition-colors duration-300 ease-out md:hidden ${navTextClass}`}
        type="button"
        aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? <X size={20} /> : <Menu size={22} />}
      </button>

      <motion.nav
        className={`py-8 absolute left-0 top-[100px] w-full border-b px-5 sm:px-8 md:static md:flex md:w-auto md:items-center md:gap-5 md:border-0 md:bg-transparent md:p-0 lg:gap-10 ${
          isOpen
            ? 'grid gap-4 border-[#ddd] bg-[#fafafa] text-[#121212]'
            : 'hidden border-transparent md:flex'
        }`}
        aria-label="Main navigation"
        initial={false}
      >
        {navItems.map((item) => (
          <a
            key={item.target}
            className={`w-max border-b border-transparent transition-colors duration-300 ease-out hover:border-[#ff5330] hover:text-[#ff5330] ${type.navLink} ${
              overHero ? 'md:text-white' : 'md:text-[#121212]'
            }`}
            href={`#${item.target}`}
            onClick={(event) => scrollToSection(event, item.target)}
          >
            {item.label}
          </a>
        ))}
        <button
          className={`inline-flex min-h-10 w-full items-center justify-center border px-5 transition-all duration-300 ease-out md:w-auto ${type.navButton} ${
            overHero
              ? 'border-white/70 bg-transparent text-white hover:bg-white/10'
              : 'border-[#222] bg-[#fafafa] text-[#121212] hover:bg-[#f4f4f4]'
          }`}
          type="button"
          onClick={(event) => scrollToSection(event, 'map')}
        >
          Map
        </button>
        <button
          className={`inline-flex min-h-10 w-full items-center justify-center border border-[#ff5330] bg-[#ff5330] px-5 text-white transition-transform duration-300 ease-out hover:-translate-y-0.5 md:w-auto ${type.navButton}`}
          type="button"
          onClick={callEmergency}
        >
          Call 999
        </button>
      </motion.nav>
    </header>
  )
}

export default Navbar
