import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Building,
  ChevronDown,
  ExternalLink,
  Flame,
  LocateFixed,
  MapPin,
  Phone,
  Siren,
} from 'lucide-react'
import { buttonHover, buttonTap, sectionGroup, sectionItem, sectionViewport } from '../lib/motion.js'
import { type } from '../lib/typography.js'

export const DEFAULT_NATIONAL_FALLBACK = {
  emergency_numbers: [
    { number: '999', label: 'National Emergency Service' },
    { number: '16163', label: 'Fire Service & Civil Defence' },
  ],
  note: 'For urgent fire, rescue, ambulance, or police emergencies, call the national emergency numbers immediately.',
}

function cleanPhone(raw) {
  return String(raw ?? '').replace(/[^0-9+]/g, '')
}

function FireStationCard({ station, index }) {
  return (
    <motion.article
      className="group relative flex h-full min-h-[265px] flex-col overflow-hidden rounded-xl border border-[#ddd] bg-[#f4f4f4] p-5 pl-7 transition-colors hover:border-[#ff5330] hover:bg-[#fff6f4]"
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ transitionDelay: `${index * 40}ms` }}
    >
      <span className="absolute left-0 top-0 h-full w-1.5 bg-[#121212] transition-colors group-hover:bg-[#ff5330]" />

      <div className="flex items-start gap-3">
        <div className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#fff0ed]">
          <Flame size={20} className="text-[#ff5330]" />
        </div>

        <div className="min-w-0 flex-1">
          <h4 className={`m-0 line-clamp-2 text-[#121212] ${type.label}`}>
            {station.station_name}
          </h4>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full bg-[#fff0ed] px-2.5 py-0.5 text-[#ff5330] ${type.legal}`}>
              <MapPin size={11} />
              {station.upazila || station.district || 'Nearby area'}
            </span>

            {station.division && (
              <span className={`text-[#999] ${type.legal}`}>
                {station.division} Division
              </span>
            )}
          </div>
        </div>
      </div>

      {station.phone_numbers?.length > 0 ? (
        <div className="mt-4 grid min-h-[76px] gap-1.5 border-t border-[#e8e8e8] pt-3">
          {station.phone_numbers.map((num) => (
            <a
              key={num}
              href={`tel:${cleanPhone(num)}`}
              className={`inline-flex items-center gap-2 text-[#121212] no-underline transition-colors hover:text-[#ff5330] ${type.bodySmall}`}
            >
              <Phone size={14} className="shrink-0 text-[#ff5330]" />
              {num}
            </a>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex min-h-[76px] items-center border-t border-[#e8e8e8] pt-3">
          <p className={`m-0 text-[#888] ${type.bodySmall}`}>
            No direct phone number listed. Use the emergency hotline below.
          </p>
        </div>
      )}

      <div className="mt-auto grid gap-2 pt-4">
        {station.address && (
          <p className={`m-0 line-clamp-2 text-[#888] ${type.legal}`}>
            {station.address}
          </p>
        )}

        {station.source_url && (
          <a
            href={station.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex w-fit items-center gap-1 text-[#888] no-underline transition-colors hover:text-[#ff5330] ${type.legal}`}
          >
            <ExternalLink size={11} />
            Source
          </a>
        )}
      </div>
    </motion.article>
  )
}

function NationalHotlines({ fallback }) {
  const safeFallback = fallback || DEFAULT_NATIONAL_FALLBACK
  if (!safeFallback?.emergency_numbers?.length) return null

  return (
    <motion.div
      id="emergency-999"
      className="mx-auto grid w-full gap-5 rounded-2xl border-2 border-[#121212] bg-[#121212] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6 md:p-7"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
    >
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#ff5330] sm:h-14 sm:w-14">
          <Siren size={24} className="text-white" />
        </div>

        <div>
          <h4 className={`m-0 text-white ${type.cardTitle}`}>
            National Emergency Hotlines
          </h4>
          <p className={`m-0 mt-1 text-[#b8b8b8] ${type.bodySmall}`}>
            Nationwide emergency support available 24/7
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {safeFallback.emergency_numbers.map((entry) => (
          <a
            key={`${entry.number}-${entry.label}`}
            href={`tel:${cleanPhone(entry.number)}`}
            className="group/hotline flex min-h-[82px] items-center gap-3 rounded-xl border border-[#333] bg-[#1a1a1a] px-4 py-3 no-underline transition-colors hover:border-[#ff5330] hover:bg-[#2a1a17]"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#2b2b2b] transition-colors group-hover/hotline:bg-[#ff5330]">
              <Phone size={17} className="text-[#ff5330] transition-colors group-hover/hotline:text-white" />
            </div>

            <div className="min-w-0">
              <span className={`block font-extrabold text-white ${type.label}`}>
                {entry.number}
              </span>
              <span className={`block truncate text-[#999] group-hover/hotline:text-[#ddd] ${type.legal}`}>
                {entry.label}
              </span>
            </div>
          </a>
        ))}
      </div>

      {safeFallback.note && (
        <p className={`m-0 border-t border-[#2a2a2a] pt-4 text-[#999] ${type.legal}`}>
          {safeFallback.note}
        </p>
      )}
    </motion.div>
  )
}

function FireServiceSkeleton() {
  return (
    <div className="grid animate-pulse items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="relative min-h-[265px] overflow-hidden rounded-xl border border-[#e8e8e8] bg-[#f4f4f4] p-5 pl-7">
          <span className="absolute left-0 top-0 h-full w-1.5 bg-[#121212]" />
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-full bg-[#e0e0e0]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-[#e0e0e0]" />
              <div className="h-3 w-1/2 rounded bg-[#e8e8e8]" />
            </div>
          </div>
          <div className="mt-4 space-y-2 border-t border-[#e8e8e8] pt-3">
            <div className="h-3.5 w-2/3 rounded bg-[#e8e8e8]" />
            <div className="h-3.5 w-1/2 rounded bg-[#e8e8e8]" />
            <div className="h-3.5 w-3/4 rounded bg-[#e8e8e8]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function FireServiceSection({
  geoStatus,
  fireStations,
  fireLoading,
  fireError,
  fireNote,
  fireDistrict,
  nationalFallback,
  visibleFireStations,
  hiddenFireCount,
  fireShowAll,
  onLocate,
  onToggleShowAll,
}) {
  const statusText = fireLoading
    ? 'Searching the fire service directory near your current location...'
    : fireDistrict
      ? `Showing fire service stations in ${fireDistrict} district.`
      : 'Input your location to see nearby fire services and national emergency numbers.'

  return (
    <section id="fire-services" className="scroll-mt-[100px] bg-[#fafafa]">
      <motion.div
        className="mx-auto grid w-full max-w-[1440px] gap-8 px-5 py-14 sm:px-8 sm:py-16 md:px-10 md:py-20 lg:px-16 lg:py-[112px] xl:px-20"
        variants={sectionGroup}
        initial="hidden"
        whileInView="visible"
        viewport={sectionViewport}
      >
        <motion.div className="mx-auto max-w-[760px] text-center" variants={sectionItem}>
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[#fff0ed] sm:h-16 sm:w-16">
            <Flame size={28} className="text-[#ff5330]" />
          </div>
          <h2 className={`m-0 text-[#121212] ${type.sectionTitle}`}>
            Nearby Fire Services
          </h2>
          <p className={`mx-auto mt-4 max-w-[680px] text-[#5e5e5e] ${type.body}`}>
            {statusText}
          </p>

          {fireDistrict && !fireLoading && fireStations.length > 0 && (
            <span className={`mx-auto mt-5 inline-flex items-center gap-2 border border-[#c8c8c8] bg-white px-4 py-2 text-[#5e5e5e] ${type.legal}`}>
              <Building size={14} className="text-[#ff5330]" />
              {fireStations.length} station{fireStations.length !== 1 ? 's' : ''} found
            </span>
          )}
        </motion.div>

        <motion.div className="grid gap-6" variants={sectionItem}>
          {geoStatus === 'idle' && (
            <motion.div
              className="mx-auto flex w-full flex-col items-center gap-4 rounded-2xl border border-[#ffd4ca] bg-[#fff6f4] p-5 text-center sm:p-6 md:flex-row md:text-left"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white">
                <LocateFixed size={21} className="text-[#ff5330]" />
              </div>

              <div className="min-w-0 flex-1">
                <h3 className={`m-0 text-[#121212] ${type.cardTitle}`}>
                  Input your location to see nearby fire services
                </h3>
                <p className={`m-0 mt-1 text-[#5e5e5e] ${type.bodySmall}`}>
                  After your area is detected, nearby fire station cards will appear here.
                  Emergency hotline numbers stay visible below this section even before location access.
                </p>
              </div>

              <motion.button
                className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[#ff5330] bg-[#ff5330] px-5 text-white ${type.button}`}
                type="button"
                onClick={onLocate}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                <LocateFixed size={16} />
                Use my location
              </motion.button>
            </motion.div>
          )}

          {fireNote && !fireLoading && (
            <motion.div
              className="mx-auto flex w-full items-start gap-3 rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#c2410c]" />
              <p className={`m-0 text-[#7c2d12] ${type.bodySmall}`}>{fireNote}</p>
            </motion.div>
          )}

          {fireError && !fireLoading && (
            <motion.div
              className="mx-auto flex w-full items-start gap-3 rounded-xl border border-[#fca5a5] bg-[#fef2f2] px-4 py-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#ef4444]" />
              <p className={`m-0 text-[#991b1b] ${type.bodySmall}`}>{fireError}</p>
            </motion.div>
          )}

          {fireLoading && <FireServiceSkeleton />}

          {!fireLoading && fireStations.length > 0 && (
            <div className="grid gap-5">
              <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleFireStations.map((station, index) => (
                  <FireStationCard
                    key={`${station.station_name}-${station.upazila}-${index}`}
                    station={station}
                    index={index}
                  />
                ))}
              </div>

              {hiddenFireCount > 0 && (
                <div className="flex justify-center sm:justify-end">
                  <motion.button
                    type="button"
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#121212] bg-[#121212] px-5 text-white transition-colors hover:border-[#ff5330] hover:bg-[#ff5330] ${type.button}`}
                    onClick={onToggleShowAll}
                    whileHover={buttonHover}
                    whileTap={buttonTap}
                  >
                    {fireShowAll ? 'Show less' : `Show more ${hiddenFireCount}`}
                    <ChevronDown
                      size={16}
                      className={`transition-transform ${fireShowAll ? 'rotate-180' : ''}`}
                    />
                  </motion.button>
                </div>
              )}
            </div>
          )}

          <NationalHotlines fallback={nationalFallback || DEFAULT_NATIONAL_FALLBACK} />
        </motion.div>
      </motion.div>
    </section>
  )
}

export default FireServiceSection
