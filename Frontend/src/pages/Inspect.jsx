import { useState, useRef, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check, Upload, Loader2, AlertTriangle, LocateFixed,
  Building2, Layers, DoorOpen, Hammer, Landmark, Wrench, MapPin, ImageUp, ArrowLeft,
  Scan,
} from 'lucide-react'
import { api } from '../config/api.js'
import InspectResults from '../components/InspectResults.jsx'
import { buttonTap, sectionGroup, sectionItem, sectionViewport } from '../lib/motion.js'
import { type } from '../lib/typography.js'

/* ── Step definitions ── */
const STEPS = [
  { title: 'Upload a building photo', body: 'Take or upload a clear photo of a building wall, column, or structural element for crack analysis.' },
  { title: 'Building questionnaire', body: 'Answer a few quick questions about the building to improve the risk assessment accuracy.' },
  { title: 'Location (optional)', body: 'Share your location for site hazard and soil analysis. This step is optional but improves accuracy.' },
  { title: 'Analyzing your building', body: 'Our ML models are analyzing the image and computing a risk score. This may take up to 30 seconds.' },
  { title: 'Assessment complete', body: 'Review your building risk assessment results below.' },
]

/* ── Questionnaire options ── */
const Q_FIELDS = [
  { key: 'building_age', label: 'Building age', icon: Building2, options: [
    { value: '<10y', label: 'Under 10 years' }, { value: '10-30y', label: '10–30 years' },
    { value: '>30y', label: 'Over 30 years' }, { value: 'unknown', label: 'Unknown' },
  ]},
  { key: 'stories', label: 'Number of stories', icon: Layers, options: [
    { value: '1-2', label: '1–2' }, { value: '3-5', label: '3–5' }, { value: '6+', label: '6+' },
  ]},
  { key: 'soft_story', label: 'Soft story (open ground floor)?', icon: DoorOpen, options: [
    { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Unsure' },
  ]},
  { key: 'structural_material', label: 'Structural material', icon: Hammer, options: [
    { value: 'rc_frame', label: 'RC Frame' }, { value: 'load_bearing_masonry', label: 'Masonry' },
    { value: 'informal_other', label: 'Informal / Other' },
  ]},
  { key: 'foundation_settlement', label: 'Foundation settlement signs?', icon: Landmark, options: [
    { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Unsure' },
  ]},
  { key: 'prior_damage', label: 'Prior earthquake damage?', icon: Wrench, options: [
    { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Unsure' },
  ]},
  { key: 'crack_location', label: 'Where are the cracks?', icon: MapPin, options: [
    { value: 'column_beam_joint', label: 'Column/Beam joint' }, { value: 'load_bearing_wall', label: 'Load-bearing wall' },
    { value: 'plaster_partition', label: 'Plaster / Partition' }, { value: 'unsure', label: 'Unsure' },
  ]},
]

const DEFAULT_Q = { building_age: 'unknown', stories: '1-2', soft_story: 'unsure', structural_material: 'load_bearing_masonry', foundation_settlement: 'unsure', prior_damage: 'unsure', crack_location: 'unsure' }
const Q_SLIDES = [
  { title: 'Building profile', fields: Q_FIELDS.slice(0, 4) },
  { title: 'Damage indicators', fields: Q_FIELDS.slice(4) },
]
const SCENARIO_EVENTS = [
  { value: '', label: 'No scenario shaking model' },
  { value: 'event_1', label: 'Mw 6.6 shallow earthquake scenario' },
  { value: 'event_2', label: 'Mw 6.8 moderate-depth earthquake scenario' },
  { value: 'event_3', label: 'Mw 7.0 regional earthquake scenario' },
  { value: 'event_4', label: 'Mw 7.2 major earthquake scenario' },
  { value: 'event_5', label: 'Mw 7.4 severe shaking scenario' },
  { value: 'event_6', label: 'Mw 7.6 high-impact earthquake scenario' },
  { value: 'event_7', label: 'Mw 7.8 extreme earthquake scenario' },
  { value: 'event_8', label: 'Mw 8.0 maximum planning scenario' },
]
/* ── Loading messages ── */
const LOADING_MSGS = [
  'Preparing secure image upload...',
  'Validating and resizing the building photo...',
  'Checking that the image shows a building surface...',
  'Running crack and damage detection...',
  'Combining questionnaire and location evidence...',
  'Calculating final severity score...',
]

const STEP_DETAILS = [
  {
    title: 'Photo intake',
    items: [
      'The uploaded photo is kept at a fixed preview size so the inspection form stays stable.',
      'Accepted files are JPEG, PNG, and WebP images under 8MB.',
      'Use a clear view of a wall, column, beam joint, or other building surface.',
    ],
  },
  {
    title: 'Questionnaire evidence',
    items: [
      'Your answers estimate structural vulnerability before the image model result is added.',
      'Unknown answers are allowed, but precise answers improve the final score.',
      'Crack location matters because structural cracks carry more risk than plaster cracks.',
    ],
  },
  {
    title: 'Location and shaking',
    items: [
      'Location is optional and only used to check nearby hazard and scenario grid points.',
      'Scenario labels represent the trained earthquake event IDs available in the backend.',
      'If you skip location, the assessment still uses the photo and questionnaire.',
    ],
  },
  {
    title: 'Model pipeline',
    items: [
      'The backend validates and resizes the image before forwarding it to the ML service.',
      'The first model checks whether the image looks like a building surface.',
      'Crack evidence, questionnaire answers, and optional location signals are combined into one score.',
    ],
  },
]

function StepInfoPanel({ step, className = '' }) {
  const detail = STEP_DETAILS[Math.min(step, STEP_DETAILS.length - 1)]
  return (
    <div className={`grid content-start gap-4 border border-[#c8c8c8] bg-[#fafafa] p-5 ${className}`}>
      <div>
        <p className={`m-0 text-[#ff5330] ${type.overline}`}>Current stage</p>
        <h3 className={`m-0 mt-2 text-[#121212] ${type.cardTitle}`}>{detail.title}</h3>
      </div>
      <ul className="m-0 grid gap-3 pl-0">
        {detail.items.map((item) => (
          <li key={item} className={`flex gap-3 text-[#5e5e5e] ${type.bodySmall}`}>
            <Check size={16} className="mt-1 shrink-0 text-[#ff5330]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Shared styles ── */
const btnBase = `inline-flex min-h-10 items-center justify-center gap-2 border px-5 transition-transform hover:-translate-y-0.5 ${type.button}`
const outlineBtn = `${btnBase} border-[#222] bg-[#fafafa] text-[#121212]`
const darkBtn = `${btnBase} border-[#ff5330] bg-[#ff5330] text-white`

/* ── Step indicator ── */
function StepIndicator({ active, total }) {
  const cappedActive = Math.min(active, total)
  return (
    <div className="mb-[30px] flex w-full items-center" aria-label={`Step ${Math.min(active + 1, total)} of ${total}`}>
      {Array.from({ length: total }).map((_, i) => {
        const done = i < cappedActive, cur = i === cappedActive && cappedActive < total
        return (
          <div className="flex flex-1 items-center last:flex-none" key={i}>
            <motion.span
              className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-bold sm:h-9 sm:w-9 md:h-10 md:w-10 ${
                done ? 'border-[#121212] bg-[#121212] text-white'
                : cur ? 'border-[#ff5330] bg-[#fafafa] text-[#ff5330]'
                : 'border-[#c8c8c8] bg-[#fafafa] text-[#5e5e5e]'
              }`}
              animate={{ scale: cur ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {done ? (
                  <motion.span key="c" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.4 }} transition={{ type: 'spring', stiffness: 420, damping: 22 }}>
                    <Check size={16} strokeWidth={3} />
                  </motion.span>
                ) : (
                  <motion.span key="n" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>{i + 1}</motion.span>
                )}
              </AnimatePresence>
            </motion.span>
            {i < total - 1 && (
              <span className="relative h-px flex-1 overflow-hidden bg-[#c8c8c8]" aria-hidden="true">
                <motion.span className="absolute inset-y-0 left-0 bg-[#ff5330]" initial={false} animate={{ width: i < active ? '100%' : '0%' }} transition={{ duration: 0.35 }} />
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Main Inspect Component ── */
function Inspect() {
  const [step, setStep] = useState(0)
  const [questionnaireSlide, setQuestionnaireSlide] = useState(0)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [questionnaire, setQuestionnaire] = useState({ ...DEFAULT_Q })
  const [scenarioEventId, setScenarioEventId] = useState('')
  const [userPos, setUserPos] = useState(null)
  const [geoStatus, setGeoStatus] = useState('idle')
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MSGS[0])
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [rejected, setRejected] = useState(null)
  const [bypassGate, setBypassGate] = useState(false)
  const fileRef = useRef(null)
  const msgInterval = useRef(null)

  const stopLoadingTicker = useCallback(() => {
    clearInterval(msgInterval.current)
    msgInterval.current = null
  }, [])

  useEffect(() => {
    return () => stopLoadingTicker()
  }, [stopLoadingTicker])

  const reset = () => {
    setStep(0); setImageFile(null); setImagePreview(null)
    setQuestionnaire({ ...DEFAULT_Q }); setQuestionnaireSlide(0); setScenarioEventId(''); setUserPos(null); setGeoStatus('idle'); setDragActive(false)
    setLoading(false); setError(null); setResult(null); setRejected(null); setBypassGate(false)
    stopLoadingTicker()
  }

  /* Image handling */
  const handleFile = (file) => {
    if (!file) return
    const valid = ['image/jpeg', 'image/png', 'image/webp']
    if (!valid.includes(file.type)) { setError('Please upload a JPEG, PNG, or WebP image.'); return }
    if (file.size > 8 * 1024 * 1024) { setError('Image must be under 8MB.'); return }
    setError(null); setRejected(null); setResult(null); setBypassGate(false); setImageFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragActive(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = () => setDragActive(false)

  /* Questionnaire */
  const updateQ = (key, value) => setQuestionnaire(prev => ({ ...prev, [key]: value }))

  /* Geolocation */
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) { setGeoStatus('denied'); return }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (p) => { setUserPos([p.coords.latitude, p.coords.longitude]); setGeoStatus('granted') },
      () => setGeoStatus('denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  /* Submit to backend */
  const submitAssessment = useCallback(async (options = {}) => {
    if (!imageFile) return
    const shouldBypassGate = options.bypassGate ?? bypassGate
    setStep(3); setLoading(true); setError(null); setRejected(null)
    let msgIdx = 0
    setLoadingMsg(LOADING_MSGS[0])
    msgInterval.current = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MSGS.length - 1)
      setLoadingMsg(LOADING_MSGS[msgIdx])
    }, 4000)

    try {
      const form = new FormData()
      form.append('image', imageFile)
      form.append('questionnaire', JSON.stringify(questionnaire))
      if (shouldBypassGate) form.append('bypass_gate', 'true')
      if (userPos) { form.append('lat', userPos[0]); form.append('lon', userPos[1]) }
      if (userPos && scenarioEventId) form.append('scenario_event_id', scenarioEventId)

      const res = await api.post('/v1/risk-assessment', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      })

      stopLoadingTicker()

      if (res.data.rejected) {
        setRejected(res.data); setBypassGate(false); setStep(0); setLoading(false); return
      }
      setResult(res.data); setStep(4); setLoading(false)
    } catch (err) {
      stopLoadingTicker()
      console.error('[Inspect] Assessment error:', err)
      const details = err.response?.data?.details
      const detailText = Array.isArray(details) && details.length > 0
        ? ` ${details.map((item) => `${item.field}: ${item.message}`).join(' ')}`
        : ''
      const msg = err.response?.data?.error
        ? `${err.response.data.error}${detailText}`
        : err.code === 'ECONNABORTED'
          ? 'The assessment timed out. The ML service may still be waking up; please try again in 30-60 seconds.'
          : err.code === 'ERR_NETWORK'
            ? 'Unable to reach the server. Make sure the backend is running.'
            : 'Assessment failed. Please try again.'
      setError(msg); setStep(2); setLoading(false)
    }
  }, [bypassGate, imageFile, questionnaire, scenarioEventId, stopLoadingTicker, userPos])

  const bypassImageGate = () => {
    setRejected(null)
    setBypassGate(true)
    submitAssessment({ bypassGate: true })
  }

  /* Navigation */
  const canNext = step === 0 ? !!imageFile : true
  const goBack = () => {
    setError(null)
    if (step === 1 && questionnaireSlide > 0) { setQuestionnaireSlide((current) => current - 1); return }
    setStep(s => Math.max(0, s - 1))
  }
  const goNext = () => {
    setError(null)
    if (step === 1 && questionnaireSlide < Q_SLIDES.length - 1) { setQuestionnaireSlide((current) => current + 1); return }
    if (step === 2) { submitAssessment(); return }
    setStep(s => Math.min(STEPS.length - 1, s + 1))
  }

  const activeStep = STEPS[step]
  const visibleSteps = 5 // total step circles

  return (
    <section id="inspect" className="scroll-mt-[66px]">
      <motion.div
        className="mx-auto grid w-full max-w-[1440px] items-stretch gap-10 px-5 py-14 sm:px-8 sm:py-16 md:px-10 md:py-20 lg:grid-cols-[minmax(0,520px)_minmax(360px,1fr)] lg:gap-20 lg:px-16 lg:py-[112px] xl:gap-[120px] xl:px-20"
        variants={sectionGroup} initial="hidden" whileInView="visible" viewport={sectionViewport}
      >
        {/* Title */}
        <motion.div className="mx-auto max-w-[760px] text-center lg:col-span-2" variants={sectionItem}>
          <h2 className={type.sectionTitle}>Start your inspection request</h2>
          <p className={`mx-auto mt-4 max-w-[620px] text-[#5e5e5e] ${type.body}`}>
            Upload a building photo and answer a few questions to receive an AI-powered structural risk assessment.
          </p>
        </motion.div>

        {/* Left: form */}
        <motion.div className={`mx-auto w-full ${step === 4 ? 'max-w-none lg:col-span-2' : 'max-w-[520px] lg:flex lg:flex-col'}`} variants={sectionItem}>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { handleFile(e.target.files[0]); e.target.value = '' }} />
          <StepIndicator active={step === 4 && result ? visibleSteps : step} total={visibleSteps} />
          <h2 className={type.formTitle}>{activeStep.title}</h2>
          <p className={`my-[18px] mb-7 text-[#5e5e5e] ${type.bodySmall}`}>{activeStep.body}</p>

          {/* Rejection warning */}
          {rejected && step === 0 && (
            <motion.div className="mb-5 grid gap-3 rounded-lg border border-[#fed7aa] bg-[#fff7ed] px-4 py-3"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#c2410c]" />
                <p className={`m-0 text-[#7c2d12] ${type.bodySmall}`}>{rejected.rejection_reason}</p>
              </div>
              <div className="flex flex-wrap gap-3 pl-0 sm:pl-8">
                <motion.button className={darkBtn} type="button" onClick={bypassImageGate} disabled={loading} whileTap={buttonTap}>
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Bypass and analyze crack
                </motion.button>
                <motion.button className={outlineBtn} type="button" onClick={() => fileRef.current?.click()} whileTap={{ scale: 0.98 }}>
                  Replace image
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <motion.div className="mb-5 flex items-start gap-3 rounded-lg border border-[#fca5a5] bg-[#fef2f2] px-4 py-3"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#ef4444]" />
              <p className={`m-0 text-[#991b1b] ${type.bodySmall}`}>{error}</p>
            </motion.div>
          )}

          <div className={step === 4 ? '' : 'lg:flex-1'}>
          <AnimatePresence mode="wait">
            <motion.div className={step === 4 ? '' : 'h-full'} key={step} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.25 }}>

              {/* Step 0: Upload */}
              {step === 0 && (
                <div className="grid h-full gap-[18px]">
                  <StepInfoPanel step={step} className="h-full" />
                  {!imagePreview && (
                    <div className="border border-[#c8c8c8] bg-[#f4f4f4] p-5">
                      <p className={`m-0 text-[#333] ${type.label}`}>Use the upload panel on the right</p>
                      <p className={`m-0 mt-2 text-[#777] ${type.bodySmall}`}>
                        Click or drag your building image into the right panel. This keeps one visible preview surface through the entire inspection.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 1: Questionnaire */}
              {step === 1 && (
                <div className="grid h-full gap-5">
                  <div className="flex items-center justify-between border border-[#c8c8c8] bg-[#fafafa] p-4">
                    <div>
                      <p className={`m-0 text-[#ff5330] ${type.overline}`}>Part {questionnaireSlide + 1} of {Q_SLIDES.length}</p>
                      <h3 className={`m-0 mt-2 text-[#121212] ${type.cardTitle}`}>{Q_SLIDES[questionnaireSlide].title}</h3>
                    </div>
                    <div className="flex gap-2" aria-hidden="true">
                      {Q_SLIDES.map((slide, index) => (
                        <span
                          key={slide.title}
                          className={`h-2.5 w-8 rounded-full ${index === questionnaireSlide ? 'bg-[#ff5330]' : 'bg-[#d9d9d9]'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4">
                  {Q_SLIDES[questionnaireSlide].fields.map(({ key, label, icon: Icon, options }) => (
                    <div key={key} className="grid gap-2">
                      <span className={`flex items-center gap-2 text-[#333] ${type.label}`}>
                        <Icon size={15} className="text-[#ff5330]" /> {label}
                      </span>
                      <div className="grid auto-rows-fr gap-2 sm:grid-cols-2">
                        {options.map((opt) => (
                          <motion.button key={opt.value} type="button"
                            className={`${btnBase} h-full min-h-11 whitespace-normal px-3.5 text-center text-[13px] ${
                              questionnaire[key] === opt.value
                                ? 'border-[#ff5330] bg-[#ff5330] text-white'
                                : 'border-[#c8c8c8] bg-[#fafafa] text-[#333]'
                            }`}
                            onClick={() => updateQ(key, opt.value)}
                            whileTap={{ scale: 0.97 }}
                          >
                            {opt.label}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  ))}
                  </div>
                </div>
              )}

              {/* Step 2: Location */}
              {step === 2 && (
                <div className="grid h-full gap-[18px]">
                  <div className="flex flex-col items-center gap-4 border border-[#c8c8c8] bg-[#f4f4f4] p-6 text-center">
                    {geoStatus === 'granted' && userPos ? (
                      <>
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f0fdf4]">
                          <Check size={24} className="text-[#16a34a]" />
                        </div>
                        <p className={`m-0 text-[#333] ${type.label}`}>Location captured</p>
                        <p className={`m-0 text-[#888] ${type.meta}`}>
                          {userPos[0].toFixed(4)}, {userPos[1].toFixed(4)}
                        </p>
                      </>
                    ) : geoStatus === 'locating' ? (
                      <>
                        <Loader2 size={28} className="animate-spin text-[#ff5330]" />
                        <p className={`m-0 text-[#555] ${type.label}`}>Getting your location…</p>
                      </>
                    ) : (
                      <>
                        <div className="grid h-14 w-14 place-items-center rounded-full bg-[#fff0ed]">
                          <LocateFixed size={24} className="text-[#ff5330]" />
                        </div>
                        <p className={`m-0 text-[#333] ${type.label}`}>
                          {geoStatus === 'denied' ? 'Location access denied' : 'Enable location for better results'}
                        </p>
                        <motion.button className={darkBtn} type="button" onClick={getLocation} whileTap={buttonTap}>
                          <LocateFixed size={15} />
                          {geoStatus === 'denied' ? 'Try Again' : 'Share Location'}
                        </motion.button>
                      </>
                    )}
                  </div>
                  <p className={`m-0 text-center text-[#999] ${type.legal}`}>
                    Location is used for site hazard analysis only and is never stored.
                  </p>
                  <div className="grid gap-2 border border-[#c8c8c8] bg-[#fafafa] p-4">
                    <span className={`flex items-center gap-2 text-[#333] ${type.label}`}>
                      <MapPin size={15} className="text-[#ff5330]" />
                      Scenario shaking model
                    </span>
                    <select
                      className={`min-h-11 w-full border border-[#c8c8c8] bg-white px-3 text-[#121212] outline-none focus:border-[#ff5330] disabled:cursor-not-allowed disabled:bg-[#eee] disabled:text-[#888] ${type.bodySmall}`}
                      value={scenarioEventId}
                      onChange={(event) => setScenarioEventId(event.target.value)}
                      disabled={!userPos}
                    >
                      {SCENARIO_EVENTS.map((event) => (
                        <option key={event.value || 'none'} value={event.value}>
                          {event.label}
                        </option>
                      ))}
                    </select>
                    <p className={`m-0 text-[#888] ${type.legal}`}>
                      Optional. Requires location and adds scenario shaking to the final score when backend scenario data exists nearby.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Processing — left side shows pipeline info, right side blurs */}
              {step === 3 && (
                <div className="grid h-full gap-5">
                  <div className="flex flex-col items-center gap-4 border border-[#fed7aa] bg-[#fff7ed] p-8 text-center">
                    <div className="grid h-16 w-16 place-items-center rounded-full bg-[#fff0ed]">
                      <Scan size={28} className="text-[#ff5330]" />
                    </div>
                    <h3 className={`m-0 text-[#121212] ${type.cardTitle}`}>Analysis in progress</h3>
                    <AnimatePresence mode="wait">
                      <motion.p key={loadingMsg} className={`m-0 max-w-[340px] text-[#333] ${type.bodySmall}`}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
                        {loadingMsg}
                      </motion.p>
                    </AnimatePresence>
                    <span className={`mt-1 text-[#777] ${type.meta}`}>This may take up to 30 seconds</span>
                  </div>
                  <StepInfoPanel step={step} />
                </div>
              )}

              {/* Step 4: Results */}
              {step === 4 && result && (
                <InspectResults result={result} imagePreview={imagePreview} onBack={() => setStep(2)} onReset={reset} />
              )}
            </motion.div>
          </AnimatePresence>
          </div>

          {/* Navigation buttons */}
          {step < 3 && (
            <div className="mt-[26px] flex justify-end gap-3">
              <motion.button className={outlineBtn} type="button" onClick={goBack} disabled={step === 0} whileTap={{ scale: 0.98 }}>
                <ArrowLeft size={15} />
                Back
              </motion.button>
              <motion.button className={darkBtn} type="button" onClick={goNext} disabled={!canNext || loading} whileTap={buttonTap}>
                {step === 2 ? (
                  <><Upload size={15} /> Submit Assessment</>
                ) : (
                  'Next'
                )}
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* Right: image preview panel */}
        {step !== 4 && (
        <motion.div
          className="mx-auto min-h-[300px] w-full max-w-[630px] overflow-hidden rounded-lg sm:min-h-[380px] md:min-h-[430px] lg:h-full lg:max-w-none"
          variants={sectionItem}
        >
          {imagePreview ? (
            <div className="relative h-full bg-[#ececec]">
              <img
                src={imagePreview}
                alt="Building preview"
                className={`h-full w-full object-contain transition-all duration-700 ${
                  loading ? 'blur-[8px] brightness-[0.4]' : ''
                }`}
              />
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                  <Loader2 size={48} className="animate-spin text-[#ff5330]" />
                  <motion.p key={loadingMsg + '-right'} className={`m-0 text-center text-white ${type.label}`}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    {loadingMsg}
                  </motion.p>
                </div>
              )}
              {result && !loading && (
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-6">
                  <div>
                    <p className="m-0 text-sm font-bold text-white/70">Risk Assessment</p>
                    <p className="m-0 text-[28px] font-extrabold text-white">
                      {result.final_tier} — {Math.round(result.final_score)}/100
                    </p>
                  </div>
                </div>
              )}
              {!loading && (
                <motion.button
                  type="button"
                  className={`absolute right-4 top-4 inline-flex min-h-10 items-center justify-center gap-2 border border-[#222] bg-[#fafafa] px-4 text-[#121212] shadow-sm ${type.button}`}
                  onClick={() => fileRef.current?.click()}
                  whileTap={{ scale: 0.98 }}
                >
                  <ImageUp size={15} />
                  Replace
                </motion.button>
              )}
            </div>
          ) : (
            <button
              type="button"
              className={`flex h-full min-h-[300px] w-full cursor-pointer flex-col items-center justify-center gap-3 border border-dashed bg-[#ececec] p-8 text-center transition-colors hover:border-[#ff5330] hover:bg-[#fff6f4] sm:min-h-[380px] md:min-h-[430px] lg:min-h-full ${
                dragActive ? 'border-[#ff5330] bg-[#fff6f4]' : 'border-[#c8c8c8]'
              }`}
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <motion.span
                className="grid h-16 w-20 place-items-center rounded-lg bg-[#fff0ed] text-[#ff5330]"
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              >
                <ImageUp size={42} strokeWidth={2.2} />
              </motion.span>
              <p className={`m-0 text-[#333] ${type.label}`}>Attach a building photo</p>
              <p className={`m-0 max-w-[280px] !text-center text-[#888] ${type.meta}`}>
                The preview will blur during ML analysis while the severity score is calculated.
              </p>
            </button>
          )}
        </motion.div>
        )}
      </motion.div>
    </section>
  )
}

export default Inspect

