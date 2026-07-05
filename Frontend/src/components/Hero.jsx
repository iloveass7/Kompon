import { useState } from "react";
import { ArrowRight, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import {
  buttonHover,
  buttonTap,
  sectionGroup,
  sectionItem,
  sectionViewport,
} from "../lib/motion.js";
import { type } from "../lib/typography.js";

const HERO_IMAGE = "/hero-coast2.png";

function BlinkingRootCircle({ cx, cy, delay = "0s" }) {
  return (
    <g>
      {/* White soft aura */}
      <circle
        cx={cx}
        cy={cy}
        r="9"
        fill="#ffffff"
        fillOpacity="0.32"
      >
        <animate
          attributeName="r"
          begin={delay}
          dur="2.2s"
          repeatCount="indefinite"
          values="9;25;9"
        />
        <animate
          attributeName="fill-opacity"
          begin={delay}
          dur="2.2s"
          repeatCount="indefinite"
          values="0.32;0.04;0.32"
        />
      </circle>

      {/* Orange soft aura */}
      <circle
        cx={cx}
        cy={cy}
        r="7"
        fill="#ff5330"
        fillOpacity="0.22"
      >
        <animate
          attributeName="r"
          begin={delay}
          dur="2.2s"
          repeatCount="indefinite"
          values="7;19;7"
        />
        <animate
          attributeName="fill-opacity"
          begin={delay}
          dur="2.2s"
          repeatCount="indefinite"
          values="0.22;0.03;0.22"
        />
      </circle>

      {/* White outer ring */}
      <circle
        cx={cx}
        cy={cy}
        r="11"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.72"
        strokeWidth="2.4"
      >
        <animate
          attributeName="r"
          begin={delay}
          dur="2.2s"
          repeatCount="indefinite"
          values="11;28;11"
        />
        <animate
          attributeName="stroke-opacity"
          begin={delay}
          dur="2.2s"
          repeatCount="indefinite"
          values="0.72;0;0.72"
        />
      </circle>

      {/* Orange inner ring */}
      <circle
        cx={cx}
        cy={cy}
        r="9"
        fill="none"
        stroke="#ff5330"
        strokeOpacity="0.55"
        strokeWidth="2"
      >
        <animate
          attributeName="r"
          begin={delay}
          dur="2.2s"
          repeatCount="indefinite"
          values="9;22;9"
        />
        <animate
          attributeName="stroke-opacity"
          begin={delay}
          dur="2.2s"
          repeatCount="indefinite"
          values="0.55;0;0.55"
        />
      </circle>

      {/* Main root marker */}
      <circle
        cx={cx}
        cy={cy}
        r="9"
        fill="#ffffff"
        stroke="#ff5330"
        strokeWidth="3.2"
      >
        <animate
          attributeName="fill-opacity"
          begin={delay}
          dur="2.2s"
          repeatCount="indefinite"
          values="1;0.75;1"
        />
      </circle>
    </g>
  );
}

function Hero() {
  const [imageReady, setImageReady] = useState(false);

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-[#121212] text-white"
    >
      {/* Background image layer + fallback */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1b1b1b] via-[#141414] to-[#242424]" />
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden="true"
          onLoad={() => setImageReady(true)}
          onError={() => setImageReady(false)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            imageReady ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* readability overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d]/85 via-[#0d0d0d]/55 to-transparent" />

        {!imageReady && (
          <div
            className={`absolute right-6 top-6 hidden items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-1.5 font-semibold text-white/70 backdrop-blur sm:flex ${type.legal}`}
          >
            <ImageIcon size={14} className="text-[#ff5330]" />
            Loading risk image
          </div>
        )}
      </div>

      {/* Content */}
      <motion.div
        className="relative z-10 mx-auto flex min-h-[600px] w-full max-w-[1440px] flex-col justify-center px-5 pb-25 pt-20 sm:px-8 md:min-h-[640px] md:px-10 md:pb-48 md:pt-38 lg:min-h-[720px] lg:px-16 lg:pb-56 xl:px-20"
        variants={sectionGroup}
        initial="hidden"
        whileInView="visible"
        viewport={sectionViewport}
      >
        <motion.div
          className="max-w-[560px] sm:mx-auto lg:mx-0"
          variants={sectionItem}
        >
          <span
            className="mb-6 block h-0.5 w-12 bg-[#ff5330]"
            aria-hidden="true"
          />
          <h1 className={type.heroTitle}>
            Earthquake readiness for Bangladesh
          </h1>
          <p className={`my-6 max-w-[460px] text-[#dcdcdc] ${type.bodySmall}`}>
            Kompon brings alerts, building inspection guidance, open-place mapping,
            and emergency contacts into one practical earthquake safety workspace.
          </p>
          <motion.button
            className={`group inline-flex min-h-11 items-center gap-3 rounded-full bg-[#ff5330] py-2 pl-6 pr-2 text-white ${type.button}`}
            type="button"
            onClick={() =>
              document
                .getElementById("map")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            Explore the map
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
              <ArrowRight size={18} strokeWidth={2.4} />
            </span>
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Earthquake risk annotations — orange arrows with blinking root markers */}
      <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
        {/* Annotation 1: arrow rises up toward the label */}
        <div className="absolute right-[4%] top-[16%] flex items-start xl:right-[13%]">
          <svg
            className="h-[176px] w-[194px] shrink-0 overflow-visible"
            viewBox="0 0 160 145"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20,130 L20,60 L142.08,15.37"
              stroke="#ff5330"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M133.81,24.78 L142.08,15.37 L129.69,13.51"
              fill="none"
              stroke="#ff5330"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <BlinkingRootCircle cx="20" cy="132" delay="0s" />
          </svg>

          <p className="max-w-[278px] text-[20px] font-bold leading-snug text-white [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
            Bangladesh lies at the junction of three tectonic plates
          </p>
        </div>

        {/* Annotation 2: arrow drops down toward the label */}
        <div className="absolute right-[7%] top-[52%] flex items-end xl:right-[20%]">
          <svg
            className="h-[176px] w-[194px] shrink-0 overflow-visible"
            viewBox="0 0 160 145"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20,25 L20,95 L146.19,126.21"
              stroke="#ff5330"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M134.07,129.39 L146.19,126.21 L136.95,117.75"
              fill="none"
              stroke="#ff5330"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <BlinkingRootCircle cx="20" cy="16" delay="0.45s" />
          </svg>

          <p className="max-w-[278px] pl-1 text-[20px] font-bold text-white [text-shadow:0_1px_12px_rgb(0_0_0/0.6)]">
            Over 250 earthquakes have struck the country in 50 years
          </p>
        </div>
      </div>

      {/* Torn / watercolor white bottom edge that bleeds into the map section */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-px z-10 leading-[0]">
        <svg
          className="block h-[90px] w-full sm:h-[120px] md:h-[150px]"
          viewBox="0 0 1440 160"
          preserveAspectRatio="none"
          fill="#fafafa"
          aria-hidden="true"
        >
          <path d="M0,78 C70,34 150,104 236,80 C330,54 384,116 470,96 C566,72 626,26 724,58 C820,90 880,40 980,72 C1076,102 1150,46 1256,78 C1338,104 1398,58 1440,82 L1440,160 L0,160 Z" />
        </svg>

        {/* watercolor droplets for organic feel */}
        <svg
          className="absolute -top-6 left-0 hidden h-14 w-full sm:block"
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          fill="#fafafa"
          aria-hidden="true"
        >
          <circle cx="320" cy="40" r="5" />
          <circle cx="705" cy="30" r="7" />
          <circle cx="712" cy="48" r="3" />
          <circle cx="1030" cy="42" r="4" />
        </svg>
      </div>
    </section>
  );
}

export default Hero;