import { useState } from 'react'
import { motion } from 'framer-motion'
import { buttonHover, buttonTap, sectionGroup, sectionItem, sectionViewport } from '../lib/motion.js'
import { type } from '../lib/typography.js'
import { BD_VIEWBOX, BD_DIVISIONS, BD_OUTLINE } from '../assets/bangladesh.js'

function Map() {
  const [isExpanded, setIsExpanded] = useState(false)
  const mapTransition = { duration: 0.68, ease: [0.22, 1, 0.36, 1] }
  const alignedTextColumn = 'w-full max-w-[560px] sm:mx-auto lg:mx-0'

  return (
    <section id="map" className="relative -mt-px scroll-mt-[100px] overflow-hidden bg-[#fafafa]">
      <motion.div
        className={`mx-auto flex w-full max-w-[1440px] flex-col items-center px-5 pb-16 pt-6 sm:px-8 md:px-10 md:pb-20 lg:flex-row lg:px-16 lg:pb-28 xl:px-20 ${
          isExpanded ? "gap-8 lg:gap-0" : "gap-10 lg:gap-16 xl:gap-24"
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
          className={`${alignedTextColumn} overflow-hidden text-center lg:text-left lg:shrink-0`}
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
            Earthquake Risk
            <br className="hidden lg:block" /> Across{" "}
            <br className="lg:hidden" />
            Bangladesh
          </h2>
          <p
            className={`mx-auto my-10 max-w-[560px] text-[#5e5e5e] lg:mx-0 ${type.body}`}
          >
            Eight divisions woven together by the world&apos;s largest river
            delta. From the tea hills of Sylhet to the mangroves of the
            Sundarbans, explore a land of vivid contrasts and resilient people.
          </p>
          <motion.button
            className={`inline-flex min-h-11 items-center justify-center rounded-full border border-[#222] bg-[#fafafa] px-6 text-[#121212] ${type.button}`}
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded(true)}
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            Explore the map
          </motion.button>
        </motion.div>

        {/* Right: Bangladesh map */}
        <motion.div
          className={`relative w-full ${
            isExpanded ? "mx-0 lg:-ml-4 xl:-ml-6" : "mx-auto"
          }`}
          variants={sectionItem}
          animate={{
            maxWidth: isExpanded ? 690 : 600,
            x: 0,
            scale: 1,
          }}
          layout
          transition={mapTransition}
        >
          <svg
            className="h-auto w-full overflow-visible"
            viewBox={BD_VIEWBOX}
            role="img"
            aria-label="Map of Bangladesh with major cities"
          >
            <defs>
              <pattern
                id="bd-dots"
                width="14"
                height="14"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="3"
                  cy="3"
                  r="1.5"
                  fill="#ff5330"
                  fillOpacity="0.4"
                />
              </pattern>
            </defs>

            <path
              d={BD_OUTLINE}
              fill="#ff5330"
              fillOpacity="0.08"
              transform="translate(4 6)"
            />
            <path
              d={BD_OUTLINE}
              fill="url(#bd-dots)"
              stroke="#ff5330"
              strokeLinejoin="round"
              strokeWidth="2"
            />

            {/* Division markers */}
            {BD_DIVISIONS.map((division, index) => {
              const markerRadius = division.capital ? 5 : 4;
              const pulseStart = markerRadius + 5;
              const pulseEnd = markerRadius + 18;
              const pulseDelay = `${index * 0.18}s`;

              return (
                <g key={division.name}>
                  <circle
                    cx={division.x}
                    cy={division.y}
                    r={pulseStart}
                    fill="#ff5330"
                    fillOpacity="0.34"
                  >
                    <animate
                      attributeName="r"
                      begin={pulseDelay}
                      dur="2.4s"
                      repeatCount="indefinite"
                      values={`${pulseStart};${pulseEnd};${pulseStart}`}
                    />
                    <animate
                      attributeName="fill-opacity"
                      begin={pulseDelay}
                      dur="2.4s"
                      repeatCount="indefinite"
                      values="0.34;0.04;0.34"
                    />
                  </circle>
                  <circle
                    cx={division.x}
                    cy={division.y}
                    r={markerRadius + 2}
                    fill="none"
                    stroke="#ff5330"
                    strokeOpacity="0.65"
                    strokeWidth="2"
                  >
                    <animate
                      attributeName="r"
                      begin={pulseDelay}
                      dur="2.4s"
                      repeatCount="indefinite"
                      values={`${markerRadius + 2};${pulseEnd + 2};${markerRadius + 2}`}
                    />
                    <animate
                      attributeName="stroke-opacity"
                      begin={pulseDelay}
                      dur="2.4s"
                      repeatCount="indefinite"
                      values="0.65;0;0.65"
                    />
                  </circle>
                  <circle
                    cx={division.x}
                    cy={division.y}
                    r={markerRadius}
                    fill="#ff5330"
                    stroke="#ff5330"
                    strokeWidth="2"
                  >
                    <animate
                      attributeName="fill-opacity"
                      begin={pulseDelay}
                      dur="2.4s"
                      repeatCount="indefinite"
                      values="1;0.58;1"
                    />
                  </circle>
                  <text
                    x={division.labelX}
                    y={division.labelY}
                    fontSize="17"
                    fontWeight={division.capital ? 800 : 700}
                    fill="#121212"
                    textAnchor={division.anchor || "start"}
                  >
                    {division.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </motion.div>

        <div
          className={`hidden shrink-0 ${isExpanded ? "lg:block lg:w-14 xl:w-30" : ""}`}
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
          <span
            className="mb-5 block h-0.5 w-12 bg-[#ff5330]"
            aria-hidden="true"
          />
          <p className={`mb-3 text-[#ff5330] ${type.overline}`}>
            Earthquake risk
          </p>
          <h3 className={`max-w-[430px] text-[#121212] ${type.panelTitle}`}>
            Bangladesh carries a serious seismic exposure.
          </h3>
          <p className={`mt-5 max-w-[460px] text-[#5e5e5e] ${type.bodySmall}`}>
            The country sits near active plate boundaries and fault systems,
            while dense cities, soft deltaic soil, older masonry, and critical
            infrastructure raise the possible impact of strong shaking.
          </p>
          <div className="mt-8 grid w-full grid-cols-1 gap-4">
            {[
              [
                "Urban exposure",
                "Dhaka and other fast-growing cities concentrate people, services, and vulnerable buildings.",
              ],
              [
                "Soil response",
                "Delta sediments can amplify shaking and increase damage potential in built-up zones.",
              ],
              [
                "Preparedness gap",
                "Retrofitting, open evacuation space, and response planning are central to reducing loss.",
              ],
            ].map(([title, description]) => (
              <div className="border-l-2 border-[#ff5330] pl-4" key={title}>
                <h4 className={`text-[#121212] ${type.cardTitle}`}>{title}</h4>
                <p className={`mt-1 text-[#5e5e5e] ${type.bodySmall}`}>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}

export default Map
