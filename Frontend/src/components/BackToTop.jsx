import { ArrowUp } from 'lucide-react'
import { motion } from 'framer-motion'

function BackToTop() {
  const goToTop = () => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth',
    })
  }

  return (
    <motion.button
      className="fixed bottom-[90px] right-5 z-40 grid h-14 w-14 place-items-center rounded-full border border-[#121212] bg-[#121212] text-white shadow-sm transition-colors hover:border-[#ff5330] hover:bg-[#ff5330] md:bottom-[100px] md:right-7"
      type="button"
      aria-label="Back to top"
      onClick={goToTop}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.96 }}
    >
      <ArrowUp size={24} />
    </motion.button>
  )
}

export default BackToTop
