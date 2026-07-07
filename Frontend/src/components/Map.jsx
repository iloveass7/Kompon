import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../config/api.js'
import { buttonHover, buttonTap, sectionGroup, sectionItem, sectionViewport } from '../lib/motion.js'
import { type } from '../lib/typography.js'
import { BD_VIEWBOX, BD_DIVISIONS, BD_OUTLINE, BD_PROJECTION } from '../assets/bangladesh.js'

const HEATMAP_DEFAULT_LAYER = 'static'
const MAP_MAX_WIDTH = 690
const [, , BD_VIEWBOX_WIDTH, BD_VIEWBOX_HEIGHT] = BD_VIEWBOX.split(' ').map(Number)
const QR_SCAN_BOX = {
  x: 0,
  y: 0,
  width: BD_VIEWBOX_WIDTH,
  height: BD_VIEWBOX_HEIGHT,
}
const SCAN_DURATION_MS = 3800
const SCAN_FADE_MS = 650
const SCAN_DURATION_SECONDS = SCAN_DURATION_MS / 1000
const QR_MODULES = [
  [0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2],
  [8, 0], [9, 0], [10, 0], [8, 1], [10, 1], [8, 2], [9, 2], [10, 2],
  [0, 11], [1, 11], [2, 11], [0, 12], [2, 12], [0, 13], [1, 13], [2, 13],
  [4, 1], [6, 1], [5, 2], [7, 3], [3, 4], [5, 4], [9, 4], [11, 4],
  [2, 5], [4, 5], [8, 5], [10, 5], [12, 5], [5, 6], [7, 6], [11, 6],
  [1, 7], [3, 7], [6, 7], [9, 7], [13, 7], [4, 8], [8, 8], [10, 8],
  [2, 9], [5, 9], [7, 9], [12, 9], [3, 10], [6, 10], [9, 10], [11, 10],
  [4, 12], [7, 12], [10, 12], [12, 12], [5, 13], [8, 13], [13, 13],
]

function projectLatLonToSvg(lat, lon) {
  return {
    x: lon * BD_PROJECTION.xScale + BD_PROJECTION.xOffset,
    y: lat * BD_PROJECTION.yScale + BD_PROJECTION.yOffset,
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function heatColor(score) {
  if (score >= 82) return '#7f1d1d'
  if (score >= 65) return '#c2410c'
  if (score >= 45) return '#ff5330'
  if (score >= 25) return '#fb923c'
  return '#facc15'
}

function HeatmapLegend() {
  return (
    <div className="pointer-events-none relative z-20 mb-4 w-full rounded-lg border border-[#d8d8d8] bg-white/95 px-4 py-3.5 shadow-[0_12px_32px_rgba(18,18,18,0.12)] backdrop-blur sm:absolute sm:left-auto sm:right-2 sm:top-[8%] sm:mb-0 sm:w-[250px] sm:px-3.5 sm:py-3 md:right-0 lg:right-[-2px] xl:right-[-5px]">
      <div className="mb-2.5 flex items-start justify-between gap-3">
        <div>
          <p className={`m-0 text-[#121212] ${type.label}`}>Ground response risk</p>
          <p className={`m-0 mt-0.5 text-[#777] ${type.legal}`}>Relative susceptibility scale</p>
        </div>
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[#ff5330] shadow-[0_0_0_4px_rgba(255,83,48,0.12)]" />
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full border border-[#f1f1f1]">
        <span className="flex-1 bg-[#facc15]" />
        <span className="flex-1 bg-[#fb923c]" />
        <span className="flex-1 bg-[#ff5330]" />
        <span className="flex-1 bg-[#c2410c]" />
        <span className="flex-1 bg-[#7f1d1d]" />
      </div>
      <div className={`mt-2 flex justify-between text-[#666] ${type.legal}`}>
        <span>More stable</span>
        <span>More sensitive</span>
      </div>
    </div>
  )
}

function susceptibilityBand(value) {
  if (!Number.isFinite(value)) {
    return {
      label: 'Unknown susceptibility',
      body: 'The source grid does not provide a reliable susceptibility score for this sampled cell.',
    }
  }

  if (value >= 70) {
    return {
      label: 'Very high susceptibility',
      body: 'Soft or water-sensitive ground is more likely here. Possible risks include stronger site response, settlement, bearing loss, and liquefaction-related deformation.',
    }
  }

  if (value >= 55) {
    return {
      label: 'High susceptibility',
      body: 'The grid suggests softer sediment, water influence, or drainage conditions that can increase shaking amplification and ground deformation risk.',
    }
  }

  if (value >= 40) {
    return {
      label: 'Moderate susceptibility',
      body: 'Ground conditions are mixed. Soil texture, drainage, landform, and local sediment patterns may still change earthquake response over short distances.',
    }
  }

  return {
    label: 'Lower susceptibility',
    body: 'The sampled grid suggests comparatively firmer or less water-sensitive ground, with lower expected ground-response susceptibility.',
  }
}

function HeatmapTooltip({ point }) {
  if (!point) return null

  const left = `${clamp((point.x / BD_VIEWBOX_WIDTH) * 100, 8, 82)}%`
  const top = `${clamp((point.y / BD_VIEWBOX_HEIGHT) * 100, 8, 82)}%`
  const rawScore = Number(point.value)
  const intensity = Number(point.score)
  const band = susceptibilityBand(rawScore)

  return (
    <div
      className="pointer-events-none absolute z-30 w-[min(260px,calc(100%-24px))] -translate-x-1/2 rounded-lg border border-[#121212]/15 bg-white/95 px-3 py-2.5 text-left shadow-[0_16px_36px_rgba(18,18,18,0.18)] backdrop-blur sm:w-[250px]"
      style={{ left, top }}
    >
      <p className={`m-0 text-[#121212] ${type.label}`}>{band.label}</p>
      <p className={`m-0 mt-1 text-[#666] ${type.legal}`}>
        Susceptibility score: {Number.isFinite(rawScore) ? rawScore.toFixed(1) : 'N/A'} / 100
      </p>
      <p className={`m-0 mt-1 text-[#666] ${type.legal}`}>
        Relative intensity on this map: {Number.isFinite(intensity) ? Math.round(intensity) : 0}%
      </p>
      <p className={`m-0 mt-2 text-[#555] ${type.legal}`}>
        {band.body}
      </p>
    </div>
  )
}

function QrScanAnimation() {
  const moduleSize = QR_SCAN_BOX.width / 14
  const cornerSize = 64

  return (
    <g pointerEvents="none">
      <rect
        x={QR_SCAN_BOX.x}
        y={QR_SCAN_BOX.y}
        width={QR_SCAN_BOX.width}
        height={QR_SCAN_BOX.height}
        fill="#fafafa"
        fillOpacity="0.24"
      />
      <path
        d={BD_OUTLINE}
        fill="#fafafa"
        fillOpacity="0.5"
      />
      <g>
        <rect
          x={QR_SCAN_BOX.x}
          y={QR_SCAN_BOX.y}
          width={QR_SCAN_BOX.width}
          height={QR_SCAN_BOX.height}
          fill="#ffffff"
          fillOpacity="0.1"
        />
        {QR_MODULES.map(([col, row]) => (
          <motion.rect
            key={`${col}-${row}`}
            x={QR_SCAN_BOX.x + col * moduleSize + moduleSize * 0.18}
            y={QR_SCAN_BOX.y + row * moduleSize + moduleSize * 0.18}
            width={moduleSize * 0.44}
            height={moduleSize * 0.44}
            rx="3"
            fill="#ff5330"
            initial={{ opacity: 0.08 }}
            animate={{ opacity: [0.04, 0.18, 0.06] }}
            transition={{
              duration: 1.65,
              repeat: Infinity,
              delay: ((col + row) % 7) * 0.1,
              ease: 'easeInOut',
            }}
          />
        ))}
        <motion.rect
          x={QR_SCAN_BOX.x}
          y={QR_SCAN_BOX.y}
          width={QR_SCAN_BOX.width}
          height="92"
          fill="url(#bd-qr-scan-gradient)"
          initial={{ y: -92 }}
          animate={{ y: QR_SCAN_BOX.height + 92 }}
          transition={{ duration: SCAN_DURATION_SECONDS, ease: [0.45, 0, 0.2, 1] }}
        />
        <motion.line
          x1={QR_SCAN_BOX.x}
          x2={QR_SCAN_BOX.x + QR_SCAN_BOX.width}
          y1={QR_SCAN_BOX.y}
          y2={QR_SCAN_BOX.y}
          stroke="#ff5330"
          strokeOpacity="0.78"
          strokeWidth="2.5"
          initial={{ y: 0 }}
          animate={{ y: QR_SCAN_BOX.height }}
          transition={{ duration: SCAN_DURATION_SECONDS, ease: [0.45, 0, 0.2, 1] }}
        />
      </g>

      <g>
        <rect
          x={QR_SCAN_BOX.x}
          y={QR_SCAN_BOX.y}
          width={QR_SCAN_BOX.width}
          height={QR_SCAN_BOX.height}
          fill="none"
          stroke="#ff5330"
          strokeOpacity="0.28"
          strokeWidth="1"
          strokeDasharray="7 9"
        />
        <path
          d={`M${QR_SCAN_BOX.x},${QR_SCAN_BOX.y + cornerSize} L${QR_SCAN_BOX.x},${QR_SCAN_BOX.y} L${QR_SCAN_BOX.x + cornerSize},${QR_SCAN_BOX.y}`}
          fill="none"
          stroke="#ff5330"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path
          d={`M${QR_SCAN_BOX.x + QR_SCAN_BOX.width - cornerSize},${QR_SCAN_BOX.y} L${QR_SCAN_BOX.x + QR_SCAN_BOX.width},${QR_SCAN_BOX.y} L${QR_SCAN_BOX.x + QR_SCAN_BOX.width},${QR_SCAN_BOX.y + cornerSize}`}
          fill="none"
          stroke="#ff5330"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path
          d={`M${QR_SCAN_BOX.x},${QR_SCAN_BOX.y + QR_SCAN_BOX.height - cornerSize} L${QR_SCAN_BOX.x},${QR_SCAN_BOX.y + QR_SCAN_BOX.height} L${QR_SCAN_BOX.x + cornerSize},${QR_SCAN_BOX.y + QR_SCAN_BOX.height}`}
          fill="none"
          stroke="#ff5330"
          strokeLinecap="round"
          strokeWidth="5"
        />
        <path
          d={`M${QR_SCAN_BOX.x + QR_SCAN_BOX.width - cornerSize},${QR_SCAN_BOX.y + QR_SCAN_BOX.height} L${QR_SCAN_BOX.x + QR_SCAN_BOX.width},${QR_SCAN_BOX.y + QR_SCAN_BOX.height} L${QR_SCAN_BOX.x + QR_SCAN_BOX.width},${QR_SCAN_BOX.y + QR_SCAN_BOX.height - cornerSize}`}
          fill="none"
          stroke="#ff5330"
          strokeLinecap="round"
          strokeWidth="5"
        />
      </g>
    </g>
  )
}

function Map() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [heatmapData, setHeatmapData] = useState(null)
  const [activeLayerId, setActiveLayerId] = useState(HEATMAP_DEFAULT_LAYER)
  const [heatmapRetry, setHeatmapRetry] = useState(0)
  const [hoveredHeatPoint, setHoveredHeatPoint] = useState(null)
  const [scanComplete, setScanComplete] = useState(false)
  const [scanVisible, setScanVisible] = useState(false)

  const mapTransition = { duration: 0.68, ease: [0.22, 1, 0.36, 1] }
  const alignedTextColumn = 'w-full max-w-[560px] sm:mx-auto lg:mx-0'

  useEffect(() => {
    if (!isExpanded) return undefined

    const controller = new AbortController()
    let retryTimer

    async function loadHeatmap() {
      try {
        const response = await api.get('/v1/hazard/heatmap', {
          params: {
            cell_deg: 0.035,
            limit_per_layer: 1200,
            include_scenarios: false,
          },
          signal: controller.signal,
          timeout: 12000,
        })

        const layers = response.data?.layers || []
        setHeatmapData(response.data || null)

        if (response.data?.status === 'building' && layers.length === 0) {
          retryTimer = window.setTimeout(() => {
            setHeatmapRetry((value) => value + 1)
          }, 4500)
          return
        }

        if (layers.length > 0) {
          const hasDefault = layers.some((layer) => layer.id === HEATMAP_DEFAULT_LAYER)
          setActiveLayerId(hasDefault ? HEATMAP_DEFAULT_LAYER : layers[0].id)
        }
      } catch (err) {
        if (err.name === 'CanceledError' || err.name === 'AbortError') return

        console.error('[Map] Failed to load hazard heatmap:', err)
      }
    }

    loadHeatmap()

    return () => {
      controller.abort()
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [isExpanded, heatmapRetry])

  const heatmapLayers = useMemo(() => heatmapData?.layers || [], [heatmapData])
  const activeLayer = useMemo(
    () => heatmapLayers.find((layer) => layer.id === activeLayerId) || heatmapLayers[0],
    [heatmapLayers, activeLayerId]
  )

  const projectedHeatPoints = useMemo(() => {
    if (!activeLayer?.points?.length) return []

    return activeLayer.points
      .map((point) => {
        const lat = Number(point.lat)
        const lon = Number(point.lon)
        const score = clamp(Number(point.score) || 0, 0, 100)
        const projected = projectLatLonToSvg(lat, lon)

        return {
          ...point,
          score,
          x: projected.x,
          y: projected.y,
        }
      })
      .filter((point) => point.x >= -40 && point.x <= 690 && point.y >= -40 && point.y <= 920)
  }, [activeLayer])

  const showHeatmap = isExpanded && projectedHeatPoints.length > 0 && scanComplete

  useEffect(() => {
    if (!isExpanded || projectedHeatPoints.length === 0) return undefined

    setScanComplete(false)
    setScanVisible(true)
    setHoveredHeatPoint(null)

    const timer = window.setTimeout(() => {
      setScanComplete(true)
      window.setTimeout(() => {
        setScanVisible(false)
      }, SCAN_FADE_MS)
    }, SCAN_DURATION_MS)

    return () => window.clearTimeout(timer)
  }, [isExpanded, projectedHeatPoints.length, activeLayerId])

  const handleExpand = () => {
    setIsExpanded(true)
  }

  return (
    <section id="map" className="relative -mt-px scroll-mt-[100px] overflow-hidden bg-[#fafafa]">
      <motion.div
        className={`mx-auto flex w-full max-w-[1440px] flex-col items-center px-5 pb-16 pt-6 sm:px-8 md:px-10 md:pb-20 lg:flex-row lg:px-16 lg:pb-28 xl:px-20 ${
          isExpanded ? 'gap-8 lg:gap-0' : 'gap-10 lg:gap-0'
        }`}
        variants={sectionGroup}
        initial="hidden"
        whileInView="visible"
        viewport={sectionViewport}
        layout
        transition={mapTransition}
      >
        {/* Left: copy */}
        <motion.div
          className={`${alignedTextColumn} overflow-hidden text-center lg:w-[460px] lg:max-w-none lg:shrink-0 lg:text-left`}
          variants={sectionItem}
          animate={
            isExpanded
              ? { opacity: 0, x: -72, maxWidth: 0, maxHeight: 0 }
              : { opacity: 1, x: 0, maxWidth: 560, maxHeight: 720 }
          }
          transition={mapTransition}
          aria-hidden={isExpanded}
        >
          <span
            className="mx-auto mb-6 block h-0.5 w-12 bg-[#ff5330] lg:mx-0"
            aria-hidden="true"
          />
          <h2 className={type.sectionTitle}>
            Where the Ground
            <br className="hidden lg:block" /> Can Turn{' '}
            <br className="lg:hidden" />
            Against Us
          </h2>
          <p
            className={`mx-auto my-10 max-w-[560px] text-[#5e5e5e] lg:mx-0 ${type.body}`}
          >
            Explore a national ground-response screen for Bangladesh. The
            overlay highlights where soft sediment, water influence, drainage,
            terrain, and landform conditions may raise earthquake-related
            ground risk.
          </p>
          <motion.button
            className={`inline-flex min-h-11 items-center justify-center rounded-full border border-[#222] bg-[#fafafa] px-6 text-[#121212] ${type.button}`}
            type="button"
            aria-expanded={isExpanded}
            onClick={handleExpand}
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            Explore the map
          </motion.button>
        </motion.div>

        {/* Right: Bangladesh map */}
        <motion.div
          className={`relative w-full lg:basis-[690px] lg:shrink-0 ${
            isExpanded ? 'mx-0 lg:-ml-4 xl:-ml-6' : 'mx-auto lg:mx-0 lg:ml-14 xl:ml-[7.5rem]'
          }`}
          variants={sectionItem}
          animate={{
            maxWidth: MAP_MAX_WIDTH,
            x: 0,
            scale: 1,
          }}
          layout
          transition={mapTransition}
        >
          {showHeatmap && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2, ease: 'easeOut' }}
            >
              <HeatmapLegend />
            </motion.div>
          )}

          <svg
            className="h-auto w-full overflow-visible"
            viewBox={BD_VIEWBOX}
            role="img"
            aria-label="Map of Bangladesh with earthquake hazard heatmap"
          >
            <defs>
              <pattern id="bd-dots" width="14" height="14" patternUnits="userSpaceOnUse">
                <circle cx="3" cy="3" r="1.5" fill="#ff5330" fillOpacity="0.4" />
              </pattern>

              <clipPath id="bd-heatmap-clip">
                <path d={BD_OUTLINE} />
              </clipPath>

              <filter id="bd-heatmap-soften" x="-18%" y="-18%" width="136%" height="136%">
                <feGaussianBlur stdDeviation="3.2" />
              </filter>

              <linearGradient id="bd-qr-scan-gradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#ff5330" stopOpacity="0" />
                <stop offset="35%" stopColor="#ff5330" stopOpacity="0.08" />
                <stop offset="50%" stopColor="#ff5330" stopOpacity="0.34" />
                <stop offset="65%" stopColor="#ff5330" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#ff5330" stopOpacity="0" />
              </linearGradient>
            </defs>

            <path
              d={BD_OUTLINE}
              fill="#ff5330"
              fillOpacity={isExpanded && activeLayer ? '0.035' : '0.08'}
              pointerEvents="none"
            />

            {scanVisible && (
              <motion.g
                initial={{ opacity: 0 }}
                animate={{ opacity: scanComplete ? 0 : 1 }}
                transition={{ duration: scanComplete ? 0.65 : 0.35, ease: 'easeOut' }}
              >
                <QrScanAnimation />
              </motion.g>
            )}

            {showHeatmap && (
              <motion.g
                clipPath="url(#bd-heatmap-clip)"
                filter="url(#bd-heatmap-soften)"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
              >
                {projectedHeatPoints.map((point, index) => {
                  const radius = 9 + point.score * 0.12
                  const opacity = 0.12 + (point.score / 100) * 0.34

                  return (
                    <circle
                      key={`${activeLayer?.id}-${index}-${point.lat}-${point.lon}`}
                      cx={point.x}
                      cy={point.y}
                      r={radius}
                      fill={heatColor(point.score)}
                      fillOpacity={opacity}
                      className="cursor-help"
                      pointerEvents="visiblePainted"
                      onMouseEnter={() => setHoveredHeatPoint(point)}
                      onMouseLeave={() => setHoveredHeatPoint(null)}
                      onFocus={() => setHoveredHeatPoint(point)}
                      onBlur={() => setHoveredHeatPoint(null)}
                      onClick={() => setHoveredHeatPoint(point)}
                      onTouchStart={() => setHoveredHeatPoint(point)}
                      tabIndex={0}
                    />
                  )
                })}
              </motion.g>
            )}

            <path
              d={BD_OUTLINE}
              fill={isExpanded && activeLayer ? 'transparent' : 'url(#bd-dots)'}
              stroke="#ff5330"
              strokeLinejoin="round"
              strokeWidth="2"
              pointerEvents="none"
            />

            {/* Division markers */}
            {BD_DIVISIONS.map((division, index) => {
              const markerRadius = division.capital ? 5 : 4
              const showPulse = !showHeatmap
              const pulseStart = markerRadius + 5
              const pulseEnd = markerRadius + 18
              const pulseDelay = `${index * 0.18}s`

              return (
                <g key={division.name} pointerEvents="none">
                  {showPulse && (
                    <>
                      <circle
                        cx={division.x}
                        cy={division.y}
                        r={pulseStart}
                        fill="#ff5330"
                        fillOpacity="0.24"
                      >
                        <animate
                          attributeName="r"
                          begin={pulseDelay}
                          dur="2.8s"
                          repeatCount="indefinite"
                          values={`${pulseStart};${pulseEnd};${pulseStart}`}
                        />
                        <animate
                          attributeName="fill-opacity"
                          begin={pulseDelay}
                          dur="2.8s"
                          repeatCount="indefinite"
                          values="0.24;0.03;0.24"
                        />
                      </circle>
                      <circle
                        cx={division.x}
                        cy={division.y}
                        r={markerRadius + 2}
                        fill="none"
                        stroke="#ff5330"
                        strokeOpacity="0.5"
                        strokeWidth="2"
                      >
                        <animate
                          attributeName="r"
                          begin={pulseDelay}
                          dur="2.8s"
                          repeatCount="indefinite"
                          values={`${markerRadius + 2};${pulseEnd + 2};${markerRadius + 2}`}
                        />
                        <animate
                          attributeName="stroke-opacity"
                          begin={pulseDelay}
                          dur="2.8s"
                          repeatCount="indefinite"
                          values="0.5;0;0.5"
                        />
                      </circle>
                    </>
                  )}
                  {!showPulse && (
                    <>
                      <circle
                        cx={division.x}
                        cy={division.y}
                        r={markerRadius + 6}
                        fill="#ffffff"
                        fillOpacity="0.28"
                        stroke="#ffffff"
                        strokeOpacity="0.68"
                        strokeWidth="1.8"
                      >
                        <animate
                          attributeName="r"
                          begin={pulseDelay}
                          dur="2.6s"
                          repeatCount="indefinite"
                          values={`${markerRadius + 5};${markerRadius + 14};${markerRadius + 5}`}
                        />
                        <animate
                          attributeName="fill-opacity"
                          begin={pulseDelay}
                          dur="2.6s"
                          repeatCount="indefinite"
                          values="0.3;0.07;0.3"
                        />
                        <animate
                          attributeName="stroke-opacity"
                          begin={pulseDelay}
                          dur="2.6s"
                          repeatCount="indefinite"
                          values="0.72;0.14;0.72"
                        />
                      </circle>
                      <circle
                        cx={division.x}
                        cy={division.y}
                        r={markerRadius + 6}
                        fill="none"
                        stroke="#111111"
                        strokeOpacity="0.5"
                        strokeWidth="1"
                      >
                        <animate
                          attributeName="r"
                          begin={pulseDelay}
                          dur="2.6s"
                          repeatCount="indefinite"
                          values={`${markerRadius + 5};${markerRadius + 14};${markerRadius + 5}`}
                        />
                        <animate
                          attributeName="stroke-opacity"
                          begin={pulseDelay}
                          dur="2.6s"
                          repeatCount="indefinite"
                          values="0.52;0.12;0.52"
                        />
                      </circle>
                    </>
                  )}
                  <circle
                    cx={division.x}
                    cy={division.y}
                    r={showPulse ? markerRadius : markerRadius + 1}
                    fill={showPulse ? '#ff5330' : '#ffffff'}
                    stroke={showPulse ? '#ff5330' : '#111111'}
                    strokeOpacity={showPulse ? '1' : '0.48'}
                    strokeWidth={showPulse ? '2' : '1.15'}
                  />
                  {!showPulse && (
                    <circle
                      cx={division.x}
                      cy={division.y}
                      r={2}
                      fill="#ff5330"
                      fillOpacity="0.9"
                    />
                  )}
                  <text
                    x={division.labelX}
                    y={division.labelY}
                    fontSize={showPulse ? '17' : '16'}
                    fontWeight={division.capital ? 800 : 760}
                    fill={showPulse ? '#121212' : '#ffffff'}
                    paintOrder="stroke"
                    stroke={showPulse ? '#fafafa' : '#111111'}
                    strokeWidth={showPulse ? '4' : '2.1'}
                    strokeOpacity={showPulse ? '1' : '0.82'}
                    strokeLinejoin="round"
                    textAnchor={division.anchor || 'start'}
                  >
                    {division.name}
                  </text>
                </g>
              )
            })}
          </svg>

          {showHeatmap && <HeatmapTooltip point={hoveredHeatPoint} />}
        </motion.div>

        <div
          className={`hidden shrink-0 ${isExpanded ? 'lg:block lg:w-14 xl:w-30' : ''}`}
          aria-hidden="true"
        />

        <motion.div
          className={`${alignedTextColumn} overflow-hidden lg:w-[460px] lg:max-w-none lg:shrink-0`}
          animate={
            isExpanded
              ? { opacity: 1, x: 0, maxWidth: 560, maxHeight: 720 }
              : { opacity: 0, x: 72, maxWidth: 0, maxHeight: 0 }
          }
          transition={{ ...mapTransition, delay: isExpanded ? 0.12 : 0 }}
          aria-hidden={!isExpanded}
        >
          <span className="mb-5 block h-0.5 w-12 bg-[#ff5330]" aria-hidden="true" />
          <p className={`mb-3 text-[#ff5330] ${type.overline}`}>Ground susceptibility</p>
          <h3 className={`max-w-[430px] text-[#121212] ${type.panelTitle}`}>
            A clearer look at soil-sensitive earthquake risk.
          </h3>
          <p className={`mt-5 max-w-[460px] text-[#5e5e5e] ${type.bodySmall}`}>
            This heatmap does not show live earthquakes or formal LPI values.
            It screens for ground conditions that may amplify shaking or
            contribute to settlement, bearing loss, lateral spreading, and
            liquefaction-related deformation.
          </p>
          <div className="mt-8 grid w-full grid-cols-1 gap-4">
            {[
              [
                'What it includes',
                'Soil texture, wetness and water proximity, drainage, landform, slope/elevation, and geology-confidence signals.',
              ],
              [
                'Risks indicated',
                'Higher scores point to greater potential for shaking amplification, settlement, strength loss, or liquefaction-related deformation.',
              ],
              [
                'How to use it',
                'Use it as a planning screen. A building-level decision still needs site-specific geotechnical investigation.',
              ],
            ].map(([title, description]) => (
              <div className="border-l-2 border-[#ff5330] pl-4" key={title}>
                <h4 className={`text-[#121212] ${type.cardTitle}`}>{title}</h4>
                <p className={`mt-1 text-[#5e5e5e] ${type.bodySmall}`}>{description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

export default Map
