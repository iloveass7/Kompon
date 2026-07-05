import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  Loader2,
  ImageOff,
  Newspaper,
} from 'lucide-react'
import { api } from '../config/api.js'
import { buttonTap, sectionGroup, sectionItem, sectionViewport } from '../lib/motion.js'
import { type } from '../lib/typography.js'

// ─── Constants ───
const SLIDE_TRANSITION = { duration: 0.32, ease: 'easeOut' }
const AUTO_ROTATE_MS = 8000

/**
 * Format a date string into a human-readable relative or absolute form.
 */
function formatDate(dateStr) {
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  } catch {
    return null
  }
}

// ─── Skeleton loader (matches article card layout) ───
function AlertSkeleton() {
  return (
    <div className="order-1 mx-auto max-w-[560px] lg:order-2 lg:max-w-[560px] animate-pulse">
      {/* Source badge skeleton */}
      <div className="mb-4 h-5 w-28 rounded-full bg-[#e0e0e0]" />
      {/* Title skeleton */}
      <div className="mb-3 space-y-2.5">
        <div className="h-6 w-full rounded bg-[#e0e0e0]" />
        <div className="h-6 w-4/5 rounded bg-[#e0e0e0]" />
      </div>
      {/* Summary skeleton */}
      <div className="mb-6 space-y-2">
        <div className="h-4 w-full rounded bg-[#e8e8e8]" />
        <div className="h-4 w-full rounded bg-[#e8e8e8]" />
        <div className="h-4 w-3/5 rounded bg-[#e8e8e8]" />
      </div>
      {/* Meta skeleton */}
      <div className="flex items-center gap-4">
        <div className="h-4 w-20 rounded bg-[#e8e8e8]" />
        <div className="h-4 w-24 rounded bg-[#e8e8e8]" />
      </div>
    </div>
  )
}

// ─── Image with fallback ───
function ArticleImage({ src, alt }) {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    setStatus('loading')
  }, [src])

  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
        <Newspaper size={64} className="text-[#ff5330]/40" strokeWidth={1.4} />
      </div>
    )
  }

  return (
    <>
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a2e]">
          <Loader2 size={32} className="animate-spin text-[#ff5330]/60" />
        </div>
      )}
      {status === 'error' ? (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
          <div className="flex flex-col items-center gap-2 text-[#888]">
            <ImageOff size={40} strokeWidth={1.4} />
            <span className="text-xs">Image unavailable</span>
          </div>
        </div>
      ) : (
        <img
          src={src}
          alt={alt || 'News article image'}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      )}
    </>
  )
}

// ─── Error state ───
function AlertError({ message, onRetry }) {
  return (
    <motion.div
      className="order-1 mx-auto flex max-w-[560px] flex-col items-center gap-4 py-10 text-center lg:order-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="grid h-16 w-16 place-items-center rounded-full bg-[#fff0ed]">
        <AlertTriangle size={28} className="text-[#ff5330]" />
      </div>
      <p className={`text-[#5e5e5e] ${type.body}`}>{message}</p>
      {onRetry && (
        <motion.button
          className="rounded-full border border-[#ff5330] bg-transparent px-6 py-2.5 text-sm font-bold text-[#ff5330] transition-colors hover:bg-[#ff5330] hover:text-white"
          type="button"
          onClick={onRetry}
          whileTap={buttonTap}
        >
          Try Again
        </motion.button>
      )}
    </motion.div>
  )
}

// ─── Main Component ───
function Alerts() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)

  // Fetch earthquake news from backend
  const fetchNews = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/v1/news/earthquakes', {
        params: { page: 1 },
      })
      const fetched = response.data?.articles || []
      if (fetched.length === 0) {
        setError('No earthquake news available at the moment.')
      }
      setArticles(fetched)
      setActiveIndex(0)
    } catch (err) {
      console.error('[Alerts] Failed to fetch news:', err)
      const message =
        err.response?.data?.error ||
        (err.code === 'ERR_NETWORK'
          ? 'Unable to reach the server. Make sure the backend is running.'
          : 'Failed to load earthquake news.')
      setError(message)
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNews()
  }, [fetchNews])

  // Auto-rotate slides
  useEffect(() => {
    if (articles.length <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((current) => (current === articles.length - 1 ? 0 : current + 1))
    }, AUTO_ROTATE_MS)
    return () => clearInterval(timer)
  }, [articles.length])

  const activeArticle = articles[activeIndex]

  const showPrevious = () => {
    setActiveIndex((current) => (current === 0 ? articles.length - 1 : current - 1))
  }

  const showNext = () => {
    setActiveIndex((current) => (current === articles.length - 1 ? 0 : current + 1))
  }

  // ─── Determine content for the left media panel ───
  const renderMedia = () => {
    if (loading) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
          <Loader2 size={44} className="animate-spin text-[#ff5330]/60" />
        </div>
      )
    }

    if (!activeArticle) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
          <Newspaper size={64} className="text-[#ff5330]/30" strokeWidth={1.4} />
        </div>
      )
    }

    return <ArticleImage src={activeArticle.image_url} alt={activeArticle.title} />
  }

  return (
    <section id="alerts" className="scroll-mt-[66px]">
      <motion.div
        className="mx-auto w-full max-w-[1440px] px-5 py-10 sm:px-8 sm:py-12 md:px-10 md:py-14 lg:px-16 lg:py-16 xl:px-20"
        variants={sectionGroup}
        initial="hidden"
        whileInView="visible"
        viewport={sectionViewport}
      >
        <motion.h2
          className={`mx-auto mb-8 text-center md:mb-10 lg:mb-12 ${type.sectionTitle}`}
          variants={sectionItem}
        >
          Find out the latest news about Earthquakes
        </motion.h2>

        <motion.div
          className="grid items-center gap-8 md:gap-9 lg:grid-cols-[minmax(360px,540px)_minmax(0,1fr)] lg:gap-10 xl:gap-12"
          variants={sectionItem}
        >
          {/* ── Left: Image panel ── */}
          <motion.div
            className="order-2 relative mx-auto aspect-square w-full max-w-[630px] overflow-hidden rounded-2xl shadow-lg lg:order-1"
            variants={sectionItem}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              >
                {renderMedia()}
              </motion.div>
            </AnimatePresence>

            {/* Overlay gradient for legibility */}
            {activeArticle?.image_url && !loading && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
            )}
          </motion.div>

          {/* ── Right: Article content ── */}
          {loading ? (
            <AlertSkeleton />
          ) : error ? (
            <AlertError message={error} onRetry={fetchNews} />
          ) : activeArticle ? (
            <AnimatePresence mode="wait">
              <motion.article
                key={activeIndex}
                className="order-1 mx-auto max-w-[560px] lg:order-2 lg:max-w-[560px]"
                aria-live="polite"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={SLIDE_TRANSITION}
              >
                {/* Source badge */}
                {activeArticle.source_name && (
                  <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#fff0ed] px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#ff5330]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#ff5330]">
                      {activeArticle.source_name}
                    </span>
                  </div>
                )}

                {/* Title */}
                <h3 className="m-0 text-[20px] font-extrabold leading-[1.3] sm:text-[22px] md:text-[24px]">
                  {activeArticle.title || 'Untitled Article'}
                </h3>

                {/* Summary / description */}
                {activeArticle.summary && (
                  <p className={`mt-3 text-[#5e5e5e] ${type.body}`}>
                    {activeArticle.summary}
                  </p>
                )}

                {/* Meta row: date + link */}
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  {formatDate(activeArticle.published_at) && (
                    <span className={`text-[#888] ${type.meta}`}>
                      {formatDate(activeArticle.published_at)}
                    </span>
                  )}

                  {activeArticle.source_url && (
                    <a
                      href={activeArticle.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-bold text-[#ff5330] transition-colors hover:text-[#cc3a1e] no-underline"
                    >
                      Read full article
                      <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              </motion.article>
            </AnimatePresence>
          ) : null}
        </motion.div>

        {/* ── Navigation controls ── */}
        {articles.length > 1 && (
          <motion.div
            className="mx-auto mt-6 flex w-full max-w-[630px] items-center justify-between md:mt-10 lg:max-w-none"
            variants={sectionItem}
          >
            {/* Dot indicators */}
            <div className="flex gap-2" aria-label="Slide position">
              {articles.map((_, index) => (
                <button
                  key={index}
                  className={`h-1.5 rounded-full border-0 p-0 transition-all ${
                    index === activeIndex ? 'w-6 bg-[#ff5330]' : 'w-1.5 bg-[#c8c8c8]'
                  }`}
                  type="button"
                  aria-label={`Show slide ${index + 1}`}
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>

            {/* Prev / Next buttons */}
            <div className="flex gap-3.5">
              <motion.button
                className="grid h-10 w-10 place-items-center rounded-full border border-[#222] bg-[#fafafa] text-[#121212]"
                type="button"
                aria-label="Previous alert"
                onClick={showPrevious}
                whileHover={{ x: -2 }}
                whileTap={buttonTap}
              >
                <ArrowLeft size={18} />
              </motion.button>
              <motion.button
                className="grid h-10 w-10 place-items-center rounded-full border border-[#222] bg-[#fafafa] text-[#121212]"
                type="button"
                aria-label="Next alert"
                onClick={showNext}
                whileHover={{ x: 2 }}
                whileTap={buttonTap}
              >
                <ArrowRight size={18} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </section>
  )
}

export default Alerts
