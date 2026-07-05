import { useState, useEffect, useCallback, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Navigation,
  Loader2,
  AlertTriangle,
  Trees,
  Footprints,
  Fence,
  LocateFixed,
  Search,
  ChevronDown,
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../config/api.js'
import { buttonHover, buttonTap, sectionGroup, sectionItem, sectionViewport } from '../lib/motion.js'
import { type } from '../lib/typography.js'

// ─── Constants ───
const DEFAULT_CENTER = [23.8103, 90.4125] // Dhaka
const DEFAULT_ZOOM = 14
const RADIUS_OPTIONS = [500, 1000, 2000, 3000, 5000]
const OSRM_ROUTE_URL = 'https://router.project-osrm.org/route/v1/foot'

// ─── Leaflet icon fix (webpack/vite strips default marker icons) ───
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom user-location marker
const userIcon = new L.DivIcon({
  className: 'user-location-marker',
  html: `<div style="
    width: 18px; height: 18px;
    background: #ff5330;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 3px rgba(255,83,48,0.35), 0 2px 8px rgba(0,0,0,0.25);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

// Custom safe-place marker
const placeIcon = new L.DivIcon({
  className: 'safe-place-marker',
  html: `<div style="
    width: 12px; height: 12px;
    background: #16a34a;
    border: 2.5px solid #fff;
    border-radius: 50%;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
})

// ─── Type icon for a safe place ───
function placeTypeIcon(placeType) {
  const size = 15
  const props = { size, strokeWidth: 2 }
  switch (placeType) {
    case 'park':
    case 'garden':
      return <Trees {...props} />
    case 'pitch':
    case 'sports_centre':
    case 'stadium':
    case 'playground':
      return <Footprints {...props} />
    case 'recreation_ground':
    case 'village_green':
      return <Fence {...props} />
    default:
      return <MapPin {...props} />
  }
}

// ─── Format distance ───
function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// ─── Map re-center helper component ───
function MapUpdater({ center, zoom, routeCoords }) {
  const map = useMap()
  useEffect(() => {
    if (routeCoords?.length > 1) {
      map.fitBounds(routeCoords, { padding: [42, 42], maxZoom: 16, animate: true })
      return
    }

    if (center) map.setView(center, zoom, { animate: true, duration: 0.6 })
  }, [center, zoom, routeCoords, map])

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 120)
    return () => window.clearTimeout(timer)
  }, [map])

  return null
}

// ─── Skeleton loader ───
function ReliefSkeleton() {
  return (
    <div className="grid flex-1 gap-3 overflow-y-auto p-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-[#e8e8e8] bg-[#f4f4f4] p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="h-4 w-32 rounded bg-[#e0e0e0]" />
            <div className="h-4 w-6 rounded bg-[#e0e0e0]" />
          </div>
          <div className="mb-3 h-3.5 w-20 rounded bg-[#e8e8e8]" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-full rounded bg-[#e8e8e8]" />
            <div className="h-3.5 w-3/4 rounded bg-[#e8e8e8]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Place card ───
function PlaceCard({ place, index, isActive, onClick, className = '' }) {
  return (
    <motion.article
      className={`cursor-pointer border p-4 transition-colors ${
        isActive
          ? 'border-[#ff5330] bg-[#fff6f4]'
          : 'border-[#ddd] bg-[#f4f4f4] hover:border-[#bbb]'
      } ${className}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className={`m-0 truncate text-[#121212] ${type.label}`}>{place.name}</h4>
        <span className={`shrink-0 font-bold text-[#ff5330] ${type.legal}`}>
          0{index + 1}
        </span>
      </div>
      <div className="mb-3 flex items-center gap-3">
        <span className={`flex items-center gap-1.5 font-bold text-[#2b2b2b] ${type.meta}`}>
          {placeTypeIcon(place.type)}
          <span className="capitalize">{place.type?.replace(/_/g, ' ') || 'Open space'}</span>
        </span>
        <span className={`font-medium text-[#888] ${type.meta}`}>
          •  {formatDistance(place.distance_m)}
        </span>
      </div>
      <p className={`m-0 text-[#5e5e5e] ${type.bodySmall}`}>
        Located {formatDistance(place.distance_m)} from your position.{' '}
        {place.type === 'park' || place.type === 'garden'
          ? 'Open green area suitable as an assembly point.'
          : place.type === 'pitch' || place.type === 'stadium' || place.type === 'playground'
          ? 'Sports or recreation ground — large open surface.'
          : 'Open space that may serve as a temporary gathering area.'}
      </p>
    </motion.article>
  )
}

// ─── Main Component ───
function Relief() {
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userPos, setUserPos] = useState(null)
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER)
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM)
  const [radiusM, setRadiusM] = useState(1000)
  const [activeResource, setActiveResource] = useState(0)
  const [geoStatus, setGeoStatus] = useState('idle') // idle | locating | granted | denied
  const [radiusOpen, setRadiusOpen] = useState(false)
  const [routeCoords, setRouteCoords] = useState([])
  const [routeStatus, setRouteStatus] = useState('idle') // idle | loading | ready | fallback
  const radiusRef = useRef(null)
  const routeAbortRef = useRef(null)

  const activeItem = places[activeResource]

  // Close radius dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (radiusRef.current && !radiusRef.current.contains(e.target)) {
        setRadiusOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    return () => routeAbortRef.current?.abort()
  }, [])

  const mergePlaces = useCallback((incoming, existing = []) => {
    const merged = new Map()
    ;[...existing, ...incoming].forEach((place) => {
      const key = `${Number(place.lat).toFixed(6)}:${Number(place.lon).toFixed(6)}:${place.name}`
      merged.set(key, place)
    })

    return Array.from(merged.values()).sort((a, b) => a.distance_m - b.distance_m)
  }, [])

  // ─── Fetch safe places ───
  const fetchPlaces = useCallback(
    async (lat, lon, radius) => {
      setLoading(true)
      setError(null)
      try {
        const response = await api.get('/v1/safe-places', {
          params: { lat, lon, radius_m: radius },
        })
        const fetched = response.data?.places || []
        if (fetched.length === 0) {
          setError('No open places found nearby. Try increasing the search radius.')
        }
        setPlaces((current) => {
          const reusable = current.filter((place) => place.distance_m <= radius)
          const nextPlaces = mergePlaces(fetched, reusable)
          if (nextPlaces.length > 0) setError(null)
          return nextPlaces
        })
        setActiveResource(0)
        setRouteCoords([])
        setRouteStatus('idle')
      } catch (err) {
        console.error('[Relief] Failed to fetch safe places:', err)
        const message =
          err.response?.data?.error ||
          (err.code === 'ERR_NETWORK'
            ? 'Unable to reach the server. Make sure the backend is running.'
            : 'Failed to find nearby safe places.')
        setPlaces((current) => {
          const reusable = current.filter((place) => place.distance_m <= radius)
          if (reusable.length > 0) {
            setError(null)
            return reusable
          }

          setError(message)
          return []
        })
      } finally {
        setLoading(false)
      }
    },
    [mergePlaces]
  )

  // ─── Get user location + fetch ───
  const locateAndFetch = useCallback(
    (radius = radiusM) => {
      if (!navigator.geolocation) {
        setError('Geolocation is not supported by your browser.')
        return
      }

      setGeoStatus('locating')
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserPos([latitude, longitude])
          setMapCenter([latitude, longitude])
          setMapZoom(radius <= 1000 ? 15 : radius <= 2000 ? 14 : 13)
          setGeoStatus('granted')
          fetchPlaces(latitude, longitude, radius)
        },
        (err) => {
          console.error('[Relief] Geolocation error:', err)
          setGeoStatus('denied')
          // Fall back to Dhaka center
          setUserPos(DEFAULT_CENTER)
          setMapCenter(DEFAULT_CENTER)
          setGeoStatus('granted')
          fetchPlaces(DEFAULT_CENTER[0], DEFAULT_CENTER[1], radius)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    },
    [radiusM, fetchPlaces]
  )

  // ─── Handle radius change ───
  const handleRadiusChange = (newRadius) => {
    setRadiusM(newRadius)
    setRadiusOpen(false)
    if (userPos) {
      setMapZoom(newRadius <= 1000 ? 15 : newRadius <= 2000 ? 14 : 13)
      fetchPlaces(userPos[0], userPos[1], newRadius)
    }
  }

  // ─── Mobile carousel ───
  const showPrevious = () => {
    if (places.length === 0) return
    const nextIndex = activeResource === 0 ? places.length - 1 : activeResource - 1
    handlePlaceClick(nextIndex)
  }
  const showNext = () => {
    if (places.length === 0) return
    const nextIndex = activeResource === places.length - 1 ? 0 : activeResource + 1
    handlePlaceClick(nextIndex)
  }

  // ─── Center map on a place when clicking its card ───
  const handlePlaceClick = async (index) => {
    setActiveResource(index)
    const place = places[index]
    if (place) {
      const destination = [place.lat, place.lon]
      setMapCenter(destination)

      if (!userPos) {
        setRouteCoords([])
        setRouteStatus('idle')
        return
      }

      const fallbackRoute = [userPos, destination]
      setRouteCoords(fallbackRoute)
      setRouteStatus('loading')
      routeAbortRef.current?.abort()

      const controller = new AbortController()
      routeAbortRef.current = controller

      try {
        const coordinates = `${userPos[1]},${userPos[0]};${place.lon},${place.lat}`
        const response = await fetch(
          `${OSRM_ROUTE_URL}/${coordinates}?overview=full&geometries=geojson&steps=false`,
          { signal: controller.signal }
        )

        if (!response.ok) throw new Error(`Route request failed with ${response.status}`)

        const data = await response.json()
        const route = data.routes?.[0]?.geometry?.coordinates
        if (!Array.isArray(route) || route.length < 2) throw new Error('No route geometry returned')

        setRouteCoords(route.map(([lon, lat]) => [lat, lon]))
        setRouteStatus('ready')
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('[Relief] Failed to fetch route:', err)
        setRouteCoords(fallbackRoute)
        setRouteStatus('fallback')
      }
    }
  }

  return (
    <section id="relief" className="scroll-mt-[66px]">
      <motion.div
        className="mx-auto grid w-full max-w-[1440px] justify-items-center gap-12 px-5 py-14 sm:px-8 sm:py-16 md:gap-[70px] md:px-10 md:py-20 lg:px-16 lg:py-[112px] xl:px-20"
        variants={sectionGroup}
        initial="hidden"
        whileInView="visible"
        viewport={sectionViewport}
      >
        {/* ── Header area ── */}
        <motion.div className="relative z-30 w-full max-w-[660px] text-center" variants={sectionItem}>
          <h2 className={type.sectionTitle}>
            Search for nearest Open Places around you
          </h2>
          <p className={`mx-auto my-5 max-w-[615px] text-[#5e5e5e] md:mb-7 ${type.body}`}>
            Find nearby parks, open fields, playgrounds, and safe assembly
            points that can be used during an earthquake emergency.
          </p>

          {/* Search controls */}
          <div className="relative z-30 mx-auto mb-3.5 flex max-w-[520px] flex-wrap items-center justify-center gap-3">
            {/* Radius selector */}
            <div className="relative" ref={radiusRef}>
              <button
                type="button"
                className={`inline-flex min-h-[44px] items-center gap-2 border border-[#c8c8c8] bg-[#fafafa] px-4 text-[#121212] outline-none transition-colors hover:border-[#ff5330] ${type.bodySmall}`}
                onClick={() => setRadiusOpen(!radiusOpen)}
              >
                <Navigation size={15} className="text-[#ff5330]" />
                <span>{radiusM >= 1000 ? `${radiusM / 1000}km` : `${radiusM}m`} radius</span>
                <ChevronDown
                  size={14}
                  className={`text-[#888] transition-transform ${radiusOpen ? 'rotate-180' : ''}`}
                />
              </button>
              <AnimatePresence>
                {radiusOpen && (
                  <motion.div
                    className="absolute left-0 top-full z-[3000] mt-1 min-w-full overflow-hidden border border-[#c8c8c8] bg-white shadow-lg"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    {RADIUS_OPTIONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`block w-full px-4 py-2.5 text-left text-sm transition-colors ${
                          r === radiusM
                            ? 'bg-[#fff0ed] font-bold text-[#ff5330]'
                            : 'text-[#333] hover:bg-[#f5f5f5]'
                        }`}
                        onClick={() => handleRadiusChange(r)}
                      >
                        {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Search / Locate button */}
            <motion.button
              className={`inline-flex min-h-11 items-center justify-center gap-2 border border-[#ff5330] bg-[#ff5330] px-5 text-white ${type.button}`}
              type="button"
              onClick={() => locateAndFetch(radiusM)}
              disabled={geoStatus === 'locating'}
              whileHover={buttonHover}
              whileTap={buttonTap}
            >
              {geoStatus === 'locating' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Locating…
                </>
              ) : (
                <>
                  <Search size={16} />
                  Find Open Places
                </>
              )}
            </motion.button>
          </div>

          {geoStatus === 'idle' && (
            <small className={`block !text-center text-[#5e5e5e] ${type.legal}`}>
              We&apos;ll use your device location to search for nearby open areas.
              Your location is never stored.
            </small>
          )}

          {geoStatus === 'denied' && (
            <small className={`block !text-center text-[#c4421a] ${type.legal}`}>
              Location access was denied. Showing results around Dhaka center instead.
            </small>
          )}
        </motion.div>

        {/* ── Map + List ── */}
        <motion.div
          className="relative z-10 mx-auto grid w-full max-w-[630px] gap-5 lg:h-[540px] lg:max-w-none lg:grid-cols-[2fr_1fr] lg:gap-6"
          variants={sectionItem}
        >
          {/* Left: Map */}
          <div className="relative h-[340px] w-full overflow-hidden rounded-lg border border-[#c8c8c8] sm:h-[400px] md:h-[480px] lg:h-full">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              scrollWheelZoom={true}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater center={mapCenter} zoom={mapZoom} routeCoords={routeCoords} />

              {/* User position marker */}
              {userPos && (
                <>
                  <Marker position={userPos} icon={userIcon}>
                    <Popup>
                      <strong>Your location</strong>
                    </Popup>
                  </Marker>
                  <Circle
                    center={userPos}
                    radius={radiusM}
                    pathOptions={{
                      color: '#ff5330',
                      fillColor: '#ff5330',
                      fillOpacity: 0.06,
                      weight: 1.5,
                      dashArray: '6 4',
                    }}
                  />
                </>
              )}

              {/* Safe place markers */}
              {places.map((place, index) => (
                <Marker
                  key={`${place.lat}-${place.lon}-${index}`}
                  position={[place.lat, place.lon]}
                  icon={placeIcon}
                  eventHandlers={{
                    click: () => handlePlaceClick(index),
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: 140 }}>
                      <strong>{place.name}</strong>
                      <br />
                      <span style={{ fontSize: 12, color: '#555' }}>
                        {place.type?.replace(/_/g, ' ')} • {formatDistance(place.distance_m)}
                      </span>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {routeCoords.length > 1 && (
                <Polyline
                  positions={routeCoords}
                  pathOptions={{
                    color: routeStatus === 'fallback' ? '#c4421a' : '#ff5330',
                    weight: 5,
                    opacity: 0.88,
                    dashArray: routeStatus === 'fallback' ? '8 8' : undefined,
                  }}
                />
              )}
            </MapContainer>

            {/* Re-center button overlay */}
            {userPos && (
              <button
                type="button"
                className="absolute bottom-3 right-3 z-[1000] grid h-9 w-9 place-items-center rounded-full border border-[#ccc] bg-white text-[#333] shadow-md transition-colors hover:bg-[#f5f5f5]"
                title="Re-center on your location"
                onClick={() => setMapCenter([...userPos])}
              >
                <LocateFixed size={16} />
              </button>
            )}

            {/* Prompt overlay when no search has been done */}
            {geoStatus === 'idle' && (
              <div className="pointer-events-none absolute inset-0 z-[999] flex items-center justify-center bg-black/20">
                <div className="pointer-events-auto rounded-xl bg-white/95 px-6 py-5 text-center shadow-xl backdrop-blur">
                  <LocateFixed size={28} className="mx-auto mb-2 text-[#ff5330]" />
                  <p className={`m-0 text-[#333] ${type.label}`}>
                    Click &quot;Find Open Places&quot; to start
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Desktop scrollable list */}
          <div className="hidden h-full min-h-0 flex-col border border-[#c8c8c8] bg-[#fafafa] lg:flex">
            <div className="border-b border-[#c8c8c8] px-4 py-4">
              <h3 className={`m-0 text-[#121212] ${type.cardTitle}`}>
                Nearby open places
              </h3>
              <p className={`mt-1 font-medium text-[#5e5e5e] ${type.meta}`}>
                {loading
                  ? 'Searching…'
                  : places.length > 0
                  ? `${places.length} place${places.length !== 1 ? 's' : ''} found`
                  : 'Search to see results'}
              </p>
            </div>

            {loading ? (
              <ReliefSkeleton />
            ) : error ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#fff0ed]">
                  <AlertTriangle size={22} className="text-[#ff5330]" />
                </div>
                <p className={`m-0 max-w-[240px] text-[#5e5e5e] ${type.bodySmall}`}>{error}</p>
              </div>
            ) : places.length > 0 ? (
              <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto p-4">
                {places.map((place, index) => (
                  <PlaceCard
                    key={`${place.lat}-${place.lon}-${index}`}
                    place={place}
                    index={index}
                    isActive={index === activeResource}
                    onClick={() => handlePlaceClick(index)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <p className={`m-0 text-[#aaa] ${type.bodySmall}`}>
                  Click &quot;Find Open Places&quot; above to search.
                </p>
              </div>
            )}
          </div>

          {/* Right: Mobile carousel */}
          <div className="flex w-full flex-col border border-[#c8c8c8] bg-[#fafafa] lg:hidden">
            <div className="border-b border-[#c8c8c8] px-4 py-4 sm:px-5">
              <h3 className={`m-0 text-[#121212] ${type.cardTitle}`}>
                Nearby open places
              </h3>
              <p className={`mt-1 font-medium text-[#5e5e5e] ${type.meta}`}>
                {loading
                  ? 'Searching…'
                  : places.length > 0
                  ? `${places.length} place${places.length !== 1 ? 's' : ''} found — swipe through`
                  : 'Search to see results'}
              </p>
            </div>

            <div className="p-4 sm:p-5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={28} className="animate-spin text-[#ff5330]" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <AlertTriangle size={22} className="text-[#ff5330]" />
                  <p className={`m-0 text-[#5e5e5e] ${type.bodySmall}`}>{error}</p>
                </div>
              ) : places.length > 0 && activeItem ? (
                <>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeItem.name + activeResource}
                      initial={{ opacity: 0, x: 22 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -22 }}
                      transition={{ duration: 0.28, ease: 'easeOut' }}
                    >
                      <PlaceCard
                        place={activeItem}
                        index={activeResource}
                        isActive
                        onClick={() => handlePlaceClick(activeResource)}
                        className="min-h-[170px]"
                      />
                    </motion.div>
                  </AnimatePresence>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <div className="flex gap-2" aria-label="Relief resource position">
                      {places.map((_, index) => (
                        <button
                          key={index}
                          className={`h-1.5 rounded-full border-0 p-0 transition-all ${
                            index === activeResource ? 'w-6 bg-[#ff5330]' : 'w-1.5 bg-[#c8c8c8]'
                          }`}
                          type="button"
                          aria-label={`Show place ${index + 1}`}
                          onClick={() => handlePlaceClick(index)}
                        />
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <motion.button
                        className="grid h-10 w-10 place-items-center rounded-full border border-[#222] bg-[#fafafa] text-[#121212]"
                        type="button"
                        aria-label="Previous place"
                        onClick={showPrevious}
                        whileHover={{ x: -2 }}
                        whileTap={buttonTap}
                      >
                        <ArrowLeft size={18} />
                      </motion.button>
                      <motion.button
                        className="grid h-10 w-10 place-items-center rounded-full border border-[#222] bg-[#fafafa] text-[#121212]"
                        type="button"
                        aria-label="Next place"
                        onClick={showNext}
                        whileHover={{ x: 2 }}
                        whileTap={buttonTap}
                      >
                        <ArrowRight size={18} />
                      </motion.button>
                    </div>
                  </div>
                </>
              ) : (
                <p className={`m-0 py-6 text-center text-[#aaa] ${type.bodySmall}`}>
                  Click &quot;Find Open Places&quot; above to search.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}

export default Relief
