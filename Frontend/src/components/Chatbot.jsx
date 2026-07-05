import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bot, MessageCircle, Send, Trash2, X, Sparkles } from 'lucide-react'
import { type } from '../lib/typography.js'

const QUICK_PROMPTS = [
  'What should I do during an earthquake?',
  'How do I inspect cracks safely?',
  'How should I prepare an emergency kit?',
]

const INITIAL_MESSAGES = [
  {
    role: 'bot',
    text: 'Hi, I can help with earthquake alerts, inspection guidance, and relief planning. For immediate danger, contact local emergency services first.',
  },
]

function buildReply(input) {
  const text = input.toLowerCase()

  if (text.includes('earthquake') || text.includes('shake') || text.includes('during')) {
    return 'Drop, cover, and hold on. Stay away from glass and heavy furniture. After shaking stops, check injuries, avoid damaged structures, and use Alerts for recent earthquake updates.'
  }

  if (text.includes('crack') || text.includes('inspect') || text.includes('building')) {
    return 'Do not enter a visibly damaged building if there are major cracks, tilting, falling debris, or gas smells. Take a clear exterior photo if it is safe, then use Inspect for a screening score. High-risk results should be reviewed by a licensed structural engineer.'
  }

  if (text.includes('relief') || text.includes('safe') || text.includes('shelter') || text.includes('place')) {
    return 'Use Relief to find nearby open spaces and assembly points. Choose a place away from buildings, utility poles, bridges, and walls. If you share location, the map can route you to the selected place.'
  }

  if (text.includes('kit') || text.includes('prepare') || text.includes('emergency')) {
    return 'Prepare water, dry food, flashlight, power bank, first-aid kit, essential medicines, whistle, copies of documents, cash, and masks. Keep the kit easy to reach and review it regularly.'
  }

  if (text.includes('backend') || text.includes('server') || text.includes('error')) {
    return 'If the frontend says it cannot reach the server, make sure the backend is running, the API URL points to the backend port, and the backend environment variables are loaded correctly.'
  }

  return 'I can help with earthquake safety, crack inspection, nearby relief places, alerts, and emergency preparation. Tell me what happened or choose one of the quick prompts.'
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff0ed] text-[#ff5330]">
        <Bot size={15} />
      </div>

      <div className="rounded-2xl rounded-bl-md border border-[#fed7aa] bg-[#fff7ed] px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff5330] [animation-delay:-0.2s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff5330] [animation-delay:-0.1s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#ff5330]" />
        </div>
      </div>
    </div>
  )
}

function ChatMessage({ message }) {
  const isBot = message.role === 'bot'

  return (
    <motion.div
      className={`flex items-end gap-2 ${isBot ? 'justify-start' : 'justify-end'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {isBot && (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#fff0ed] text-[#ff5330]">
          <Bot size={15} />
        </div>
      )}

      <div
        className={`max-w-[78%] rounded-2xl border px-4 py-3 shadow-sm ${
          isBot
            ? 'rounded-bl-md border-[#e8e8e8] bg-[#fafafa] text-[#333]'
            : 'rounded-br-md border-[#ff5330] bg-[#ff5330] text-white shadow-[0_10px_30px_rgba(255,83,48,0.22)]'
        } ${type.bodySmall}`}
      >
        {message.text}
      </div>

      {!isBot && (
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#121212] text-white">
          <span className="text-[10px] font-black">You</span>
        </div>
      )}
    </motion.div>
  )
}

export default function Chatbot() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [thinking, setThinking] = useState(false)
  const [suggestionIndex, setSuggestionIndex] = useState(0)

  const responseTimer = useRef(null)
  const messagesEndRef = useRef(null)

  const canSend = input.trim().length > 0 && !thinking
  const panelTitle = useMemo(() => (thinking ? 'Kompon assistant is typing' : 'Kompon assistant'), [thinking])
  const currentSuggestion = QUICK_PROMPTS[suggestionIndex]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, thinking, open])

  useEffect(() => {
    if (!open) return undefined

    const suggestionTimer = window.setInterval(() => {
      setSuggestionIndex((current) => (current + 1) % QUICK_PROMPTS.length)
    }, 3600)

    return () => window.clearInterval(suggestionTimer)
  }, [open])

  useEffect(() => {
    return () => {
      window.clearTimeout(responseTimer.current)
    }
  }, [])

  const sendMessage = (value = input) => {
    const clean = value.trim()
    if (!clean || thinking) return

    setInput('')
    setMessages((current) => [...current, { role: 'user', text: clean }])
    setThinking(true)

    window.clearTimeout(responseTimer.current)

    responseTimer.current = window.setTimeout(() => {
      setMessages((current) => [...current, { role: 'bot', text: buildReply(clean) }])
      setThinking(false)
    }, 450)
  }

  const clearChat = () => {
    window.clearTimeout(responseTimer.current)
    setThinking(false)
    setInput('')
    setMessages(INITIAL_MESSAGES)
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.aside
            className="fixed bottom-[100px] right-4 z-50 flex h-[min(620px,calc(100vh-124px))] w-[calc(100vw-32px)] max-w-[365px] flex-col overflow-hidden rounded-[28px] border border-[#121212] bg-white shadow-[0_24px_80px_rgba(18,18,18,0.26)] md:bottom-[112px] md:right-7"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            aria-label="Kompon chatbot"
          >
            {/* Header */}
            <header className="relative overflow-hidden border-b border-[#121212] bg-[#121212] px-4 py-4 text-white">
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#ff5330] text-white shadow-[0_12px_28px_rgba(255,83,48,0.24)]">
                    <Bot size={21} />
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#121212] bg-[#22c55e]" />
                  </div>

                  <div className="min-w-0">
                    <p className={`m-0 truncate text-white text-[16px] font-extrabold ${type.label}`}>{panelTitle}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <p className={`m-0 text-[11.5px] truncate text-[#cfcfcf] ${type.legal}`}>
                        Earthquake safety guidance
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-[#d8d8d8] transition-colors hover:border-[#ff5330] hover:bg-[#ff5330] hover:text-white"
                    aria-label="Clear chat"
                    onClick={clearChat}
                  >
                    <Trash2 size={15} />
                  </button>

                  <button
                    type="button"
                    className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/5 text-[#d8d8d8] transition-colors hover:border-[#ff5330] hover:bg-[#ff5330] hover:text-white"
                    aria-label="Close chat"
                    onClick={() => setOpen(false)}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </header>

            {/* Messages */}
            <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_100%)] px-4 py-4">
              <div className="grid gap-3">
                {messages.map((message, index) => (
                  <ChatMessage key={`${message.role}-${index}-${message.text}`} message={message} />
                ))}

                {thinking && <TypingIndicator />}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Composer */}
            <div className="grid gap-3 border-t border-[#e8e8e8] bg-[#fafafa] p-3.5">
              <div className="overflow-hidden">
                <p className={`m-0 mb-2 text-[#777] ${type.legal}`}>Suggested question</p>

                <AnimatePresence mode="wait">
                  <motion.button
                    key={currentSuggestion}
                    type="button"
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-[#e1e1e1] bg-white px-3.5 py-3 text-left text-[#333] shadow-sm transition-colors hover:border-[#ff5330] hover:bg-[#fff6f4] hover:text-[#ff5330] disabled:cursor-not-allowed disabled:opacity-60 ${type.legal}`}
                    onClick={() => sendMessage(currentSuggestion)}
                    disabled={thinking}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.22 }}
                  >
                    <span className="line-clamp-1 min-w-0">{currentSuggestion}</span>
                    <Sparkles size={13} className="shrink-0 text-[#ff5330]" />
                  </motion.button>
                </AnimatePresence>
              </div>

              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  sendMessage()
                }}
              >
                <div className="relative min-w-0 flex-1">
                  <input
                    className={`min-h-12 w-full rounded-2xl border border-[#d6d6d6] bg-white px-4 text-[#121212] outline-none transition-colors placeholder:text-[#999] focus:border-[#ff5330] focus:ring-4 focus:ring-[#ff5330]/10 ${type.bodySmall}`}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Ask about safety..."
                  />
                </div>

                <button
                  type="submit"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#ff5330] bg-[#ff5330] text-white shadow-[0_12px_28px_rgba(255,83,48,0.25)] transition-colors hover:border-[#121212] hover:bg-[#121212] disabled:cursor-not-allowed disabled:border-[#d4d4d4] disabled:bg-[#d9d9d9] disabled:shadow-none"
                  aria-label="Send message"
                  disabled={!canSend}
                >
                  <Send size={18} />
                </button>
              </form>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Floating launcher */}
      <motion.button
        className="fixed bottom-5 right-5 z-40 grid h-[58px] w-[58px] place-items-center rounded-full border border-[#ff5330] bg-[#ff5330] text-white shadow-[0_18px_50px_rgba(255,83,48,0.32)] transition-colors hover:border-[#121212] hover:bg-[#121212] md:bottom-7 md:right-7"
        type="button"
        aria-label={open ? 'Close chatbot' : 'Open chatbot'}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3, scale: 1.03 }}
        whileTap={{ scale: 0.94 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={23} />
            </motion.span>
          ) : (
            <motion.span
              key="chat"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <MessageCircle size={25} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  )
}