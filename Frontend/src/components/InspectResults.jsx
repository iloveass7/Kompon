import { motion } from 'framer-motion'
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  UserCog, ArrowLeft, RotateCcw,
} from 'lucide-react'
import { type } from '../lib/typography.js'

const TIER_CONFIG = {
  'Very Low':  { color: '#16a34a', bg: '#f0fdf4', icon: ShieldCheck,  label: 'Very Low Risk' },
  'Low':       { color: '#22c55e', bg: '#f0fdf4', icon: ShieldCheck,  label: 'Low Risk' },
  'Moderate':  { color: '#eab308', bg: '#fefce8', icon: ShieldAlert,  label: 'Moderate Risk' },
  'High':      { color: '#ef4444', bg: '#fef2f2', icon: ShieldX,      label: 'High Risk' },
  'Very High': { color: '#dc2626', bg: '#fef2f2', icon: ShieldX,      label: 'Very High Risk' },
}

function ScoreGauge({ score, tier }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['Moderate']
  const rotation = (score / 100) * 180 - 90
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-[100px] w-[200px] overflow-hidden">
        <svg viewBox="0 0 200 100" className="h-full w-full">
          <path d="M10,95 A90,90 0 0,1 190,95" fill="none" stroke="#e5e7eb" strokeWidth="12" strokeLinecap="round" />
          <motion.path
            d="M10,95 A90,90 0 0,1 190,95"
            fill="none" stroke={cfg.color} strokeWidth="12" strokeLinecap="round"
            strokeDasharray="283"
            initial={{ strokeDashoffset: 283 }}
            animate={{ strokeDashoffset: 283 - (score / 100) * 283 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <motion.div
          className="absolute bottom-0 left-1/2 origin-bottom"
          style={{ width: 3, height: 70, marginLeft: -1.5 }}
          initial={{ rotate: -90 }}
          animate={{ rotate: rotation }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          <div className="h-full w-full rounded-full bg-[#333]" />
        </motion.div>
        <div className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#333]" />
      </div>
      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <span className="text-[36px] font-extrabold" style={{ color: cfg.color }}>
          {Math.round(score)}
        </span>
        <span className="ml-1 text-sm font-bold text-[#888]">/ 100</span>
      </motion.div>
    </div>
  )
}

function BreakdownBar({ label, score, weight, included, color, delay }) {
  if (!included && score === null) return null
  const pct = score != null ? score : 0
  return (
    <motion.div
      className="grid gap-1.5"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[#333] ${type.label}`}>{label}</span>
        <span className={`text-[#888] ${type.meta}`}>
          {score != null ? `${Math.round(score)}` : 'N/A'}
          {weight != null && <span className="ml-1 text-xs text-[#bbb]">({Math.round(weight * 100)}%)</span>}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#e8e8e8]">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  )
}

export default function InspectResults({ result, imagePreview, onBack, onReset }) {
  const cfg = TIER_CONFIG[result.final_tier] || TIER_CONFIG['Moderate']
  const TierIcon = cfg.icon
  const bd = result.breakdown || {}

  return (
    <motion.div
      className="grid gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <motion.div
          className="grid h-full min-h-[560px] content-between gap-5 border border-[#c8c8c8] bg-[#fafafa] p-5 sm:p-6"
          initial={{ x: -18, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          <div className="grid gap-5">
            <motion.div
              className="flex items-center gap-3 border-2 px-5 py-4"
              style={{ borderColor: cfg.color, backgroundColor: cfg.bg }}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            >
              <TierIcon size={28} style={{ color: cfg.color }} />
              <div>
                <p className={`m-0 font-extrabold ${type.cardTitle}`} style={{ color: cfg.color }}>
                  {cfg.label}
                </p>
                <p className={`m-0 mt-0.5 text-[#666] ${type.meta}`}>
                  Screening assessment result
                </p>
              </div>
            </motion.div>

            <ScoreGauge score={result.final_score} tier={result.final_tier} />

            {result.escalation_applied && (
              <motion.div
                className="flex items-start gap-3 bg-[#fef2f2] border border-[#fca5a5] px-4 py-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#ef4444]" />
                <p className={`m-0 text-[#991b1b] ${type.bodySmall}`}>
                  Risk tier was escalated due to severe crack detection or low gate confidence.
                </p>
              </motion.div>
            )}

            {result.engineer_referral_recommended && (
              <motion.div
                className="flex items-start gap-3 bg-[#fff7ed] border border-[#fed7aa] px-4 py-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <UserCog size={18} className="mt-0.5 shrink-0 text-[#c2410c]" />
                <p className={`m-0 text-[#7c2d12] ${type.bodySmall}`}>
                  A licensed structural engineer assessment is recommended.
                </p>
              </motion.div>
            )}

            <div className="grid gap-3 border-t border-[#c8c8c8] pt-4">
              <h4 className={`m-0 text-[#121212] ${type.cardTitle}`}>Score Breakdown</h4>
              <BreakdownBar label="Structural Vulnerability" score={bd.structural_vulnerability?.score} weight={bd.structural_vulnerability?.weight} included color="#ff5330" delay={0.3} />
              <BreakdownBar label="Crack Evidence" score={bd.crack_evidence?.score} weight={bd.crack_evidence?.weight} included color="#121212" delay={0.4} />
              <BreakdownBar label="Site Hazard" score={bd.site_hazard?.score} weight={bd.site_hazard?.weight} included={bd.site_hazard?.included} color="#5e5e5e" delay={0.5} />
              <BreakdownBar label="Scenario Shaking" score={bd.scenario_shaking?.score} weight={bd.scenario_shaking?.weight} included={bd.scenario_shaking?.included} color="#ff8a6b" delay={0.6} />
            </div>
          </div>

          <p className={`m-0 text-[#999] ${type.legal}`}>
            {result.disclaimer}
          </p>
        </motion.div>

        <motion.div
          className="relative h-full min-h-[560px] overflow-hidden border border-[#c8c8c8] bg-[#ececec]"
          initial={{ x: 18, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Assessed building" className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center p-8 text-center text-[#888]">
              <p className={`m-0 ${type.bodySmall}`}>No image preview is available for this result.</p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
            <p className="m-0 text-sm font-bold text-white/70">Risk Assessment</p>
            <p className="m-0 text-[28px] font-extrabold leading-tight text-white">
              {result.final_tier} - {Math.round(result.final_score)}/100
            </p>
          </div>
        </motion.div>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <motion.button
          className={`inline-flex min-h-10 items-center justify-center gap-2 border border-[#222] bg-[#fafafa] px-5 text-[#121212] transition-transform hover:-translate-y-0.5 ${type.button}`}
          type="button"
          onClick={onBack}
          whileTap={{ scale: 0.98 }}
        >
          <ArrowLeft size={15} />
          Back
        </motion.button>
        <motion.button
          className={`inline-flex min-h-10 items-center justify-center gap-2 border border-[#ff5330] bg-[#ff5330] px-5 text-white transition-transform hover:-translate-y-0.5 ${type.button}`}
          type="button"
          onClick={onReset}
          whileTap={{ scale: 0.98 }}
        >
          <RotateCcw size={15} />
          Start New Inspection
        </motion.button>
      </div>
    </motion.div>
  )
}
