'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLang } from '@/contexts/LanguageContext'

const SLIDES = [
  { key: 'slide1', icon: '🏆', gradFrom: '#0a0800', gradTo: '#141204' },
  { key: 'slide2', icon: '🤝', gradFrom: '#080808', gradTo: '#141414' },
  { key: 'slide3', icon: '💎', gradFrom: '#0a0800', gradTo: '#141204' },
  { key: 'slide4', icon: '⚡', gradFrom: '#080808', gradTo: '#141414' },
  { key: 'slide5', icon: '⚠️', gradFrom: '#0a0508', gradTo: '#120a0a', isLegal: true },
]

export default function OnboardingPage() {
  const [idx, setIdx] = useState(0)
  const [age, setAge] = useState(false)
  const [terms, setTerms] = useState(false)
  const { t } = useLang()
  const router = useRouter()
  const slide = SLIDES[idx]
  const isLast = idx === SLIDES.length - 1

  const next = async () => {
    if (isLast) {
      if (!age || !terms) return
      localStorage.setItem('onboarding_complete', 'true')
      router.replace('/auth/register')
      return
    }
    setIdx(i => i + 1)
  }

  const btnLabel = isLast ? t('onboarding.createAccount') : idx === SLIDES.length - 2 ? t('onboarding.understood') : t('onboarding.next')
  const btnDisabled = isLast && (!age || !terms)

  return (
    <div style={{ minHeight:'100dvh', background:`linear-gradient(180deg, ${slide.gradFrom}, ${slide.gradTo})`, display:'flex', flexDirection:'column', maxWidth:430, margin:'0 auto', position:'relative' }}>
      {/* Main content */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'40px 32px 0', textAlign:'center' }}>
        <div style={{ fontSize:80, marginBottom:24, lineHeight:1 }}>{slide.icon}</div>
        <h1 className="font-display" style={{ fontSize:32, color:'#f0ece4', lineHeight:1.3, marginBottom:16, whiteSpace:'pre-line' }}>
          {t(`onboarding.${slide.key}Title`)}
        </h1>
        <p style={{ fontSize:17, color:'rgba(240,236,228,0.6)', lineHeight:1.7, maxWidth:300 }}>
          {t(`onboarding.${slide.key}Sub`)}
        </p>
      </div>

      {/* Bottom */}
      <div style={{ padding:'32px 24px 48px' }}>
        {/* Dots */}
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginBottom:28 }}>
          {SLIDES.map((_, i) => (
            <div key={i} style={{ height:6, borderRadius:3, background: i === idx ? '#FFB800' : 'rgba(255,255,255,0.15)', width: i === idx ? 24 : 6, transition:'all 0.3s' }}/>
          ))}
        </div>

        {/* Legal checkboxes */}
        {isLast && (
          <div style={{ marginBottom:20, display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { val: age, set: setAge, label: t('onboarding.age18') },
              { val: terms, set: setTerms, label: t('onboarding.terms') },
            ].map(({ val, set, label }, i) => (
              <button key={i} onClick={() => set((v: boolean) => !v)} style={{ display:'flex', gap:12, alignItems:'flex-start', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
                <div style={{ width:24, height:24, borderRadius:6, border:`1.5px solid ${val ? '#FFB800' : 'rgba(255,255,255,0.2)'}`, background: val ? '#CC8800' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:2 }}>
                  {val && <span style={{ color:'#000', fontSize:14, fontWeight:700 }}>✓</span>}
                </div>
                <span style={{ fontSize:14, color:'rgba(240,236,228,0.6)', lineHeight:1.6 }}>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* CTA Button */}
        <button onClick={next} disabled={btnDisabled} style={{ width:'100%', padding:'18px', borderRadius:12, border:'none', cursor: btnDisabled ? 'not-allowed' : 'pointer', background: btnDisabled ? 'linear-gradient(135deg, #333, #444)' : 'linear-gradient(135deg, #CC8800, #FFB800, #FFE566)', color:'#000', fontFamily:'Cinzel, serif', fontSize:13, fontWeight:700, letterSpacing:3 }}>
          {btnLabel}
        </button>

        {/* Skip */}
        {!isLast && (
          <button onClick={() => router.replace('/auth/login')} style={{ width:'100%', marginTop:16, background:'none', border:'none', cursor:'pointer', color:'rgba(240,236,228,0.4)', fontSize:14, fontFamily:'Crimson Text, serif' }}>
            {t('onboarding.alreadyHave')}
          </button>
        )}
      </div>
    </div>
  )
}
