import { useState, useEffect, useRef, useCallback } from 'react'

/* ── Constants ────────────────────────────────────────────────────────────── */
const TOTAL_SECONDS = 60
const RING_R        = 82                      // bigger ring
const CIRCUMFERENCE = 2 * Math.PI * RING_R
const SPIN_MS       = 2700                    // ease-out-quint duration

/* ── Data ─────────────────────────────────────────────────────────────────── */
const categories = [
  {
    id: 'power', name: 'Power Word',
    color: '#c084fc', glow: 'rgba(192,132,252,0.45)',
    prompts: [
      'Betrayal','Ambition','Reckoning','Obsession','Surrender',
      'Legacy','Defiance','Hunger','Sacrifice','Redemption',
      'Fury','Loyalty','Desperation','Courage','Collapse',
    ],
  },
  {
    id: 'debate', name: 'Debate',
    color: '#fbbf24', glow: 'rgba(251,191,36,0.45)',
    prompts: [
      'Social media causes more loneliness than connection.',
      'Elon Musk has done more harm than good to the tech industry.',
      'Remote work has permanently broken corporate culture.',
      'AI will eliminate more jobs than it creates in the next decade.',
      'Jeff Bezos built Amazon on exploitation, not innovation.',
      'The college degree is the biggest financial scam of the 21st century.',
      'Hustle culture is a mental health crisis disguised as ambition.',
      "Tesla's success is more about Elon's personal brand than engineering.",
      'Social media influencers hold more cultural power than elected politicians.',
      'Climate activism is failing because it ignores economic self-interest.',
      'The gig economy is modern-day indentured servitude with a better UI.',
      "Apple's walled garden is anti-competitive and should be legally broken up.",
      'Billionaires are a policy failure, not a success story.',
      'The metaverse was the largest corporate hallucination in business history.',
      'Sam Altman is either saving humanity or selling it — there is no middle ground.',
    ],
  },
  {
    id: 'scenario', name: 'Scenario',
    color: '#4ade80', glow: 'rgba(74,222,128,0.45)',
    prompts: [
      "You're pitching Netflix to investors in Tokyo who think streaming is dying. 60 seconds. Go.",
      "Google offered $500M for your startup. Convince your co-founder to reject it.",
      "You're Satya Nadella. Microsoft just suffered a catastrophic public hack. Calm the board in 90 seconds.",
      "Apple rejected your app from the App Store. You have one phone call with Tim Cook. What do you say?",
      "You're presenting Airbnb's new pricing model to 500 furious hosts threatening to leave the platform.",
      "Amazon just cloned your product and listed it for half the price. Pitch your investors why you survive.",
      "You're the new CEO of X (formerly Twitter) on day one. The company is in chaos. Give the all-hands speech.",
      "Convince a room of skeptical Sequoia partners that Spotify should acquire your podcast network for $200M.",
      "Your SpaceX launch window is closing and Elon Musk is on the line asking why you're behind. Respond.",
      "You're a junior designer at Nike presenting a rebrand concept to Phil Knight. He hates your first slide.",
      "OpenAI just released a product that kills your SaaS overnight. Pitch your pivot to your team.",
      "You're the Uber spokesperson the morning after a major safety scandal breaks on the front page of the Times.",
      "Congress invited you to make the case for breaking up Facebook in 60 seconds. Go.",
      "You're raising a $50M Series A and the lead investor is Jensen Huang. He keeps asking about your GPU costs.",
      "Disney offered to license your story concept for $1M or buy it outright for $5M with no royalties. Convince the room.",
    ],
  },
  {
    id: 'question', name: 'Big Question',
    color: '#60a5fa', glow: 'rgba(96,165,250,0.45)',
    prompts: [
      'What would you tell your 14-year-old self about failure?',
      'If you could erase one decision you have made, which one — and why?',
      'What do you believe that almost no one in this room agrees with?',
      "What's the most dangerous idea you've ever seriously entertained?",
      'When did you last genuinely change your mind about something that matters?',
      'What would you do differently if you knew no one was ever watching?',
      'What is the one thing you are most afraid to admit about yourself?',
      'If your life were a documentary, what would the title be — and why?',
      'What do you value more: being right, or being trusted?',
      'At what exact moment did you realize you were becoming your parents?',
      'What would you sacrifice to guarantee your biggest dream comes true?',
      "What's the gap between the person you present to the world and who you actually are?",
      'If you could only teach one lesson to the next generation, what would it be?',
      'What does the version of you from ten years ago think of who you have become?',
      'What are you building that you hope outlives you?',
    ],
  },
  {
    id: 'wildcard', name: 'Wildcard',
    color: '#f87171', glow: 'rgba(248,113,113,0.45)',
    prompts: [
      'Describe the scariest decision you ever made.',
      'Talk about a time you were completely and utterly wrong.',
      'Describe a moment when you chose comfort over courage — and what it cost you.',
      'Tell the story of the worst professional advice you ever followed.',
      'Describe a relationship that permanently changed who you are at your core.',
      "Talk about a time you were the villain in someone else's story.",
      'Describe the version of yourself you have been quietly trying to kill off.',
      'Tell us about the moment you stopped caring what people thought — or the moment you wish you had.',
      'Describe a failure that still stings, and what you learned too late.',
      'Talk about the best decision you almost did not make.',
      'Describe a time you were completely out of your depth and kept going anyway.',
      'Tell the story of the day everything you were building almost fell apart.',
      'Describe a person who believed in you before you believed in yourself.',
      'Talk about a goal you abandoned — and whether you regret it.',
      'Describe the exact moment you realized you were capable of far more than you thought.',
    ],
  },
]

const ALL_PROMPTS = categories.flatMap(cat => cat.prompts.map(p => ({ ...cat, prompt: p })))
const N = ALL_PROMPTS.length   // 75

/* ── Audio ────────────────────────────────────────────────────────────────── */
function playTick(ctx, speedFactor = 1) {
  try {
    const t   = ctx.currentTime
    const osc = ctx.createOscillator()
    const g   = ctx.createGain()
    osc.connect(g); g.connect(ctx.destination)
    // High-pitched at fast spin, low at slow
    const baseFreq = 220 + speedFactor * 560
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(baseFreq, t)
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.28, t + 0.045)
    g.gain.setValueAtTime(0.16 + speedFactor * 0.06, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.start(t); osc.stop(t + 0.07)
  } catch (_) {}
}

function playLand(ctx) {
  try {
    const t = ctx.currentTime
    // Two-note chime: high then lower
    for (const [freq, delay, vol] of [[560, 0, 0.38], [420, 0.09, 0.28]]) {
      const osc = ctx.createOscillator()
      const g   = ctx.createGain()
      osc.connect(g); g.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t + delay)
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, t + delay + 0.22)
      g.gain.setValueAtTime(vol, t + delay)
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.28)
      osc.start(t + delay); osc.stop(t + delay + 0.32)
    }
  } catch (_) {}
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const rgb      = h => [1,3,5].map(i => parseInt(h.slice(i,i+2),16)).join(', ')
const fmt      = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`
const wrapIdx  = i => ((i % N) + N) % N

/* ── Component ───────────────────────────────────────────────────────────── */
export default function App() {
  const [spinPos,    setSpinPos]    = useState(0)
  const [isSpinning, setIsSpinning] = useState(false)
  const [landed,     setLanded]     = useState(null)
  const [timerState, setTimerState] = useState('idle')
  const [timeLeft,   setTimeLeft]   = useState(TOTAL_SECONDS)
  const [streak,     setStreak]     = useState(0)
  const [pulseOn,    setPulseOn]    = useState(true)
  const [genHov,     setGenHov]     = useState(false)
  const [startHov,   setStartHov]   = useState(false)

  const rafRef      = useRef(null)
  const spinRef     = useRef(null)   // { startPos, endPos, startTime }
  const audioRef    = useRef(null)   // AudioContext
  const lastTickRef = useRef(-1)     // last ticked center index

  /* ── Timer ── */
  useEffect(() => {
    if (timerState !== 'running') return
    if (timeLeft === 0) { setTimerState('done'); setStreak(n => n + 1); return }
    const t = setTimeout(() => setTimeLeft(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [timerState, timeLeft])

  useEffect(() => {
    if (timerState !== 'done') return
    const t = setTimeout(() => { setTimerState('idle'); setTimeLeft(TOTAL_SECONDS) }, 2200)
    return () => clearTimeout(t)
  }, [timerState])

  const isLastTen = timerState === 'running' && timeLeft <= 10
  useEffect(() => {
    if (!isLastTen) { setPulseOn(true); return }
    const t = setInterval(() => setPulseOn(v => !v), 480)
    return () => clearInterval(t)
  }, [isLastTen])

  /* ── Spin RAF loop ── */
  const animLoop = useCallback((now) => {
    const { startPos, endPos, startTime } = spinRef.current
    const rawT  = Math.min((now - startTime) / SPIN_MS, 1)
    const eased = 1 - Math.pow(1 - rawT, 5)          // ease-out-quint
    const pos   = startPos + (endPos - startPos) * eased
    setSpinPos(pos)

    // Tick sound whenever the visible center item changes
    const cIdx = wrapIdx(Math.round(pos))
    if (cIdx !== lastTickRef.current && audioRef.current) {
      lastTickRef.current = cIdx
      // speedFactor 1→0 across the spin (high pitch early, low pitch late)
      const speed = Math.pow(1 - rawT, 4)
      playTick(audioRef.current, speed)
    }

    if (rawT >= 1) {
      setIsSpinning(false)
      setLanded(ALL_PROMPTS[wrapIdx(Math.round(endPos))])
      if (audioRef.current) playLand(audioRef.current)
      return
    }
    rafRef.current = requestAnimationFrame(animLoop)
  }, [])

  const generate = () => {
    if (isSpinning) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    // Bootstrap AudioContext on first user gesture
    if (!audioRef.current) {
      audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    if (audioRef.current.state === 'suspended') audioRef.current.resume()

    setIsSpinning(true)
    setLanded(null)
    setTimerState('idle')
    setTimeLeft(TOTAL_SECONDS)
    lastTickRef.current = -1

    const finalIdx = Math.floor(Math.random() * N)
    const cur      = Math.round(spinPos)
    const delta    = ((finalIdx - cur) % N + N) % N
    const endPos   = spinPos + 4 * N + delta           // 4 full rotations then land

    spinRef.current = { startPos: spinPos, endPos, startTime: performance.now() }
    rafRef.current  = requestAnimationFrame(animLoop)
  }

  const startTimer = () => { setTimeLeft(TOTAL_SECONDS); setTimerState('running') }

  /* ── Drum data ── */
  const base      = Math.round(spinPos)
  const drumRows  = [-1, 0, 1].map(offset => {
    const intPos = base + offset
    return { item: ALL_PROMPTS[wrapIdx(intPos)], relPos: intPos - spinPos }
  })
  const centerItem = ALL_PROMPTS[wrapIdx(base)]

  /* ── Ring ── */
  const ringColor    = timerState === 'done' ? '#4ade80' : isLastTen ? '#ef4444' : landed?.color ?? 'rgba(255,255,255,0.22)'
  const strokeOffset = CIRCUMFERENCE * (1 - timeLeft / TOTAL_SECONDS)
  const timeColor    = isLastTen ? (pulseOn ? '#ef4444' : 'rgba(239,68,68,0.2)') : '#ffffff'

  /* ── Render ── */
  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0c0920',
      backgroundImage: [
        'radial-gradient(ellipse 65% 55% at 12% 35%, rgba(139,92,246,0.18) 0%, transparent 60%)',
        'radial-gradient(ellipse 55% 50% at 88% 65%, rgba(59,130,246,0.14) 0%, transparent 60%)',
        'radial-gradient(ellipse 45% 35% at 55% 95%, rgba(236,72,153,0.11) 0%, transparent 55%)',
      ].join(', '),
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Onest', 'Helvetica Neue', Arial, sans-serif",
      padding: '40px 20px 56px', boxSizing: 'border-box',
    }}>

      {/* ── Header ── */}
      <header style={{ textAlign: 'center', marginBottom: '36px' }}>
        <p style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '10px' }}>
          Speaking Challenge
        </p>
        <h1 style={{ fontSize: 'clamp(40px, 8vw, 86px)', fontWeight: '900', letterSpacing: '-2.5px', color: '#ffffff', lineHeight: 1, textTransform: 'uppercase', margin: '0 0 12px 0', textShadow: '0 0 50px rgba(167,139,250,0.35)' }}>
          Speakrn
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>
          One prompt. One minute. No filter.
        </p>
        {streak > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', marginTop: '16px', padding: '5px 16px', borderRadius: '999px', backgroundColor: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.35)', color: '#fbbf24', fontSize: '11px', fontWeight: '800', letterSpacing: '2.5px', textTransform: 'uppercase', boxShadow: '0 0 22px rgba(251,191,36,0.2)' }}>
            Streak &times; {streak}
          </div>
        )}
      </header>

      {/* ── Horizontal drum ── */}
      <div style={{
        position: 'relative',
        width: '100%', maxWidth: '700px',
        height: '156px',
        borderRadius: '22px',
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.025)',
        border: '1.5px solid rgba(255,255,255,0.08)',
        marginBottom: '32px',
        // Shared perspective for barrel depth
        perspective: '900px',
        perspectiveOrigin: '50% 50%',
        boxShadow: [
          `0 0 0 1px rgba(${rgb(centerItem.color)}, 0.12)`,
          `0 0 50px rgba(${rgb(centerItem.color)}, 0.07)`,
          'inset 0 0 40px rgba(0,0,0,0.22)',
        ].join(', '),
        // Fade items as they approach edges — horizontal this time
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
        maskImage:        'linear-gradient(to right, transparent 0%, black 20%, black 80%, transparent 100%)',
        transition: isSpinning ? 'none' : 'box-shadow 0.5s ease',
      }}>

        {/* Center selection frame — border around the active slot */}
        <div style={{
          position: 'absolute',
          // Matches the 75%-wide items positioned at 12.5% from each side
          left: '12.5%', right: '12.5%',
          top: '8px', bottom: '8px',
          borderRadius: '14px',
          border: `1.5px solid rgba(${rgb(centerItem.color)}, 0.35)`,
          boxShadow: `inset 0 0 28px rgba(${rgb(centerItem.color)}, 0.08)`,
          pointerEvents: 'none',
          zIndex: 2,
          transition: isSpinning ? 'none' : 'border-color 0.4s ease, box-shadow 0.4s ease',
        }} />

        {/* Items */}
        {drumRows.map(({ item, relPos }, i) => {
          const abs      = Math.abs(relPos)
          const isCenter = abs < 0.5
          const opacity  = Math.max(0, 1 - abs * 0.6)
          // rotateY creates the globe/barrel curve: right side of right-item curves away
          const angle    = relPos * 26
          const scale    = 1 - abs * 0.06

          return (
            <div key={i} style={{
              position: 'absolute',
              // Items are 75% wide, centered (12.5% margin each side)
              left: '12.5%',
              width: '75%',
              top: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '9px',
              padding: '14px 22px',
              // translateX uses % of element width → responsive across screen sizes
              // relPos=+1 shifts right by one item width, relPos=-1 shifts left
              transform: `translateX(${relPos * 100}%) rotateY(${angle}deg) scale(${scale})`,
              opacity,
              backfaceVisibility: 'hidden',
              willChange: 'transform, opacity',
              pointerEvents: 'none',
              zIndex: isCenter ? 1 : 0,
            }}>
              {/* Category tag */}
              <span style={{
                alignSelf: 'flex-start',
                padding: '3px 10px',
                borderRadius: '7px',
                backgroundColor: `rgba(${rgb(item.color)}, ${isCenter ? 0.2 : 0.08})`,
                border: `1px solid rgba(${rgb(item.color)}, ${isCenter ? 0.6 : 0.22})`,
                color: item.color,
                fontSize: '10px', fontWeight: '800', letterSpacing: '1.8px',
                textTransform: 'uppercase', whiteSpace: 'nowrap',
                boxShadow: isCenter ? `0 0 10px rgba(${rgb(item.color)}, 0.28)` : 'none',
              }}>
                {item.name}
              </span>

              {/* Prompt text */}
              <span style={{
                fontSize: isCenter ? '15px' : '13px',
                fontWeight: isCenter ? '700' : '500',
                color: isCenter ? '#ffffff' : 'rgba(255,255,255,0.45)',
                lineHeight: 1.42,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}>
                {item.prompt}
              </span>
            </div>
          )
        })}
      </div>

      {/* ── Timer — bigger ring (200 × 200) ── */}
      {landed && !isSpinning && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          <div style={{ position: 'relative', width: '200px', height: '200px' }}>
            <svg width="200" height="200" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
              {/* Track */}
              <circle cx="100" cy="100" r={RING_R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              {/* Progress arc */}
              <circle cx="100" cy="100" r={RING_R} fill="none"
                stroke={ringColor} strokeWidth="6"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
                style={{
                  transition: timerState === 'running'
                    ? 'stroke-dashoffset 1s linear, stroke 0.3s ease'
                    : 'stroke 0.4s ease',
                  filter: `drop-shadow(0 0 10px ${ringColor})`,
                }}
              />
            </svg>

            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {timerState === 'done' ? (
                <span style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '4px', color: '#4ade80', textShadow: '0 0 26px rgba(74,222,128,0.7)' }}>
                  DONE
                </span>
              ) : (
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: '38px', fontWeight: '700', letterSpacing: '-1px', color: timeColor, lineHeight: 1, userSelect: 'none', transition: 'color 0.12s ease' }}>
                  {fmt(timeLeft)}
                </span>
              )}
            </div>
          </div>

          {timerState === 'idle' && (
            <button
              style={{
                padding: '11px 44px',
                fontSize: '13px', fontWeight: '800', letterSpacing: '3px', textTransform: 'uppercase',
                color: startHov ? '#0c0920' : landed.color,
                backgroundColor: startHov ? landed.color : 'transparent',
                border: `2px solid ${landed.color}`,
                borderRadius: '10px', cursor: 'pointer', outline: 'none',
                transition: 'all 0.18s ease',
                boxShadow: startHov ? `0 0 30px ${landed.glow}` : `0 0 10px rgba(${rgb(landed.color)}, 0.12)`,
              }}
              onClick={startTimer}
              onMouseEnter={() => setStartHov(true)}
              onMouseLeave={() => setStartHov(false)}
            >
              Start
            </button>
          )}
        </div>
      )}

      {/* ── Generate button — green ── */}
      <button
        style={{
          padding: '16px 62px',
          fontSize: '15px', fontWeight: '800', letterSpacing: '3.5px', textTransform: 'uppercase',
          color: '#ffffff',
          background: genHov
            ? 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)'
            : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          border: 'none', borderRadius: '14px',
          cursor: isSpinning ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
          opacity: isSpinning ? 0.45 : 1, outline: 'none',
          boxShadow: genHov
            ? '0 0 44px rgba(74,222,128,0.5), 0 6px 22px rgba(0,0,0,0.25)'
            : '0 0 22px rgba(34,197,94,0.3), 0 4px 12px rgba(0,0,0,0.2)',
        }}
        onClick={generate}
        onMouseEnter={() => setGenHov(true)}
        onMouseLeave={() => setGenHov(false)}
      >
        {isSpinning ? 'Spinning…' : 'Generate'}
      </button>

      {/* ── Category dots ── */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '28px' }}>
        {categories.map(cat => {
          const active = centerItem?.id === cat.id
          return (
            <div key={cat.id} style={{
              width: active ? '22px' : '6px', height: '6px', borderRadius: '3px',
              backgroundColor: active ? cat.color : 'rgba(255,255,255,0.13)',
              boxShadow: active ? `0 0 8px ${cat.glow}` : 'none',
              transition: isSpinning ? 'none' : 'all 0.3s ease',
            }} />
          )
        })}
      </div>

    </div>
  )
}
