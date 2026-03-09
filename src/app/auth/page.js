'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ============================================================
   AUTH PAGE — migrado desde pple-tcg-auth.html
   ============================================================ */

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" style={{ flexShrink: 0 }}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
)

function PassStrength({ value }) {
  const strength = (value.length >= 12 && /[A-Z]/.test(value) && /[0-9]/.test(value)) ? 3
                 : value.length >= 8 ? 2
                 : value.length >= 4 ? 1 : 0
  const colors = ['#ff4757', '#ffa502', '#2ed573']
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{
          flex: 1, height: '3px', borderRadius: '2px',
          background: i < strength ? colors[strength - 1] : 'var(--border)',
          transition: 'background 0.2s',
        }} />
      ))}
    </div>
  )
}

function ErrorBox({ msg }) {
  if (!msg) return null
  return (
    <div style={{
      color: '#ff4757', fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
      marginBottom: '8px', padding: '8px 12px',
      background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)',
      borderRadius: '5px',
    }}>
      {msg}
    </div>
  )
}

/* ============================================================ */

export default function AuthPage() {
  const router = useRouter()
  const sb = createClient()

  // ---- GLOBAL STATE ----
  const [tab, setTab] = useState('login')            // 'login' | 'register'
  const [resetOpen, setResetOpen] = useState(false)

  // ---- LOGIN STATE ----
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass]   = useState('')
  const [loginPassVis, setLoginPassVis] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // ---- REGISTER STATE ----
  const [regStep, setRegStep]         = useState(1)   // 1..4, 5 = success
  const [accountType, setAccountType] = useState(null) // 'particular' | 'empresa'
  const [ageType, setAgeType]         = useState(null)
  const [regError, setRegError]       = useState('')
  const [regLoading, setRegLoading]   = useState(false)
  const [successEmail, setSuccessEmail] = useState('')

  // Particular fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [username, setUsername]   = useState('')
  const [regEmail, setRegEmail]   = useState('')
  const [regPass, setRegPass]     = useState('')
  const [regPassVis, setRegPassVis] = useState(false)
  const [usernameErr, setUsernameErr] = useState('')

  // Empresa fields
  const [companyName, setCompanyName]   = useState('')
  const [companyCIF, setCompanyCIF]     = useState('')
  const [companyType, setCompanyType]   = useState('')
  const [tradeName, setTradeName]       = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [companyPass, setCompanyPass]   = useState('')
  const [companyPassVis, setCompanyPassVis] = useState(false)

  // Address
  const [addrStreet, setAddrStreet]     = useState('')
  const [addrCP, setAddrCP]             = useState('')
  const [addrCity, setAddrCity]         = useState('')
  const [addrProvince, setAddrProvince] = useState('')
  const [addrCountry, setAddrCountry]   = useState('España')

  // Empresa fiscal (step 4)
  const [fiscalAddr, setFiscalAddr]       = useState('')
  const [companyIBAN, setCompanyIBAN]     = useState('')
  const [regMercantil, setRegMercantil]   = useState('')

  // Terms
  const [acceptTerms, setAcceptTerms] = useState(false)

  // ---- RESET PASSWORD STATE ----
  const [resetEmail, setResetEmail]     = useState('')
  const [resetError, setResetError]     = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSent, setResetSent]       = useState(false)

  // ---- CHECK SESSION ----
  useEffect(() => {
    sb.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/')
    })
  }, [])

  // Escape closes reset modal
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setResetOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ---- USERNAME VALIDATION ----
  function validateUsername(val) {
    if (val && !/^[a-z0-9_]{3,20}$/.test(val)) {
      setUsernameErr('Solo letras minúsculas, números y _ (3-20 caracteres)')
    } else {
      setUsernameErr('')
    }
  }

  // ---- LOGIN ----
  async function doLogin() {
    setLoginError('')
    if (!loginEmail || !loginPass) { setLoginError('Rellena email y contraseña'); return }
    setLoginLoading(true)
    const { error } = await sb.auth.signInWithPassword({ email: loginEmail, password: loginPass })
    if (error) {
      setLoginError('Email o contraseña incorrectos')
      setLoginLoading(false)
    } else {
      setTimeout(() => router.replace('/'), 400)
    }
  }

  // ---- REGISTER PARTICULAR ----
  async function doRegister() {
    setRegError('')
    if (!username || !firstName || !regEmail || !regPass) {
      setRegError('Rellena todos los campos obligatorios'); return
    }
    if (regPass.length < 6) { setRegError('Contraseña mínimo 6 caracteres'); return }
    if (!acceptTerms) { setRegError('Acepta los términos para continuar'); return }
    setRegLoading(true)
    const { error } = await sb.auth.signUp({
      email: regEmail,
      password: regPass,
      options: {
        data: {
          username,
          full_name: `${firstName} ${lastName}`.trim(),
          account_type: 'particular',
        }
      }
    })
    if (error) {
      setRegError(error.message === 'User already registered' ? 'Este email ya tiene una cuenta' : error.message)
      setRegLoading(false)
    } else {
      setSuccessEmail(regEmail)
      setRegStep(5)
    }
  }

  // ---- REGISTER EMPRESA ----
  async function doRegisterEmpresa() {
    setRegError('')
    if (!companyEmail || !companyPass || !companyName || !companyCIF) {
      setRegError('Rellena todos los campos obligatorios'); return
    }
    if (companyPass.length < 6) { setRegError('Contraseña mínimo 6 caracteres'); return }
    if (!acceptTerms) { setRegError('Acepta los términos para continuar'); return }
    setRegLoading(true)
    const { error } = await sb.auth.signUp({
      email: companyEmail,
      password: companyPass,
      options: {
        data: {
          username: companyCIF,
          full_name: companyName,
          account_type: 'empresa',
        }
      }
    })
    if (error) {
      setRegError(error.message === 'User already registered' ? 'Este email ya tiene una cuenta' : error.message)
      setRegLoading(false)
    } else {
      setSuccessEmail(companyEmail)
      setRegStep(5)
    }
  }

  function doFinishRegister() {
    if (accountType === 'empresa') doRegisterEmpresa()
    else doRegister()
  }

  // ---- RESET PASSWORD ----
  async function doSendReset() {
    setResetError('')
    if (!resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      setResetError('Introduce un email válido'); return
    }
    setResetLoading(true)
    const { error } = await sb.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/reset`,
    })
    if (error) {
      setResetError('Error al enviar. Comprueba el email e inténtalo de nuevo.')
      setResetLoading(false)
    } else {
      setResetSent(true)
      setResetLoading(false)
    }
  }

  function openReset() {
    setResetEmail(loginEmail)
    setResetError('')
    setResetSent(false)
    setResetLoading(false)
    setResetOpen(true)
  }

  // ---- HELPERS ----
  const stepDone  = (i) => i < regStep - 1
  const stepActive = (i) => i === regStep - 1

  const regSummaryRows = accountType === 'empresa'
    ? [
        ['Tipo', 'Empresa'],
        ['Razón social', companyName || '—'],
        ['CIF / NIF', companyCIF || '—'],
        ['Email', companyEmail || '—'],
        ['Ciudad', addrCity || '—'],
      ]
    : [
        ['Tipo', 'Particular'],
        ['Usuario', username || '—'],
        ['Nombre', `${firstName} ${lastName}`.trim() || '—'],
        ['Email', regEmail || '—'],
        ['Ciudad', addrCity || '—'],
      ]

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <>
      <style>{`
        .auth-layout{display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:calc(100vh - 60px);}
        .auth-left{background:var(--bg2);border-right:1px solid var(--border);padding:60px 56px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;}
        .al-glow{position:absolute;top:-100px;right:-100px;width:400px;height:400px;background:radial-gradient(circle,rgba(212,245,60,0.07) 0%,transparent 70%);pointer-events:none;}
        .al-glow2{position:absolute;bottom:-80px;left:-80px;width:300px;height:300px;background:radial-gradient(circle,rgba(46,213,115,0.05) 0%,transparent 70%);pointer-events:none;}
        .al-tag{font-family:var(--font-mono);font-size:0.65rem;color:var(--accent);letter-spacing:2px;text-transform:uppercase;border:1px solid rgba(212,245,60,0.25);padding:4px 12px;border-radius:3px;width:fit-content;margin-bottom:32px;}
        .al-headline{font-family:var(--font-display);font-size:4.5rem;line-height:0.92;letter-spacing:2px;margin-bottom:20px;}
        .al-headline .accent{color:var(--accent);}
        .al-sub{font-size:0.9rem;color:var(--text2);line-height:1.7;font-weight:300;max-width:360px;}
        .al-features{display:flex;flex-direction:column;gap:12px;margin-top:auto;padding-top:40px;}
        .al-feat{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;}
        .af-icon{font-size:1.1rem;flex-shrink:0;}
        .af-text{font-size:0.82rem;color:var(--text2);font-weight:300;line-height:1.4;}
        .af-text strong{color:var(--text);font-weight:600;}
        .auth-right{display:flex;align-items:center;justify-content:center;padding:40px;overflow-y:auto;}
        .auth-box{width:100%;max-width:440px;}
        .auth-tabs{display:flex;gap:0;border:1px solid var(--border);border-radius:7px;overflow:hidden;margin-bottom:28px;}
        .auth-tab{flex:1;padding:10px;text-align:center;font-family:var(--font-mono);font-size:0.72rem;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;border:none;background:none;color:var(--text3);transition:all 0.15s;}
        .auth-tab.active{background:var(--accent);color:#08080d;}
        .auth-tab:not(.active):hover{background:var(--surface);color:var(--text2);}
        .social-btns{display:flex;flex-direction:column;gap:8px;margin-bottom:20px;}
        .social-btn{display:flex;align-items:center;justify-content:center;gap:10px;padding:11px;border:1px solid var(--border2);border-radius:7px;background:var(--surface);color:var(--text);font-family:var(--font-mono);font-size:0.75rem;font-weight:500;letter-spacing:0.5px;cursor:pointer;transition:all 0.15s;width:100%;}
        .social-btn:hover{background:var(--surface2);}
        .social-btn.google:hover{border-color:rgba(66,133,244,0.4);}
        .social-btn.apple:hover{border-color:rgba(255,255,255,0.2);}
        .divider{display:flex;align-items:center;gap:12px;margin:18px 0;}
        .divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border);}
        .divider span{font-family:var(--font-mono);font-size:0.6rem;color:var(--text3);letter-spacing:1.5px;text-transform:uppercase;}
        .form-group{margin-bottom:14px;}
        .fg-label{font-family:var(--font-mono);font-size:0.6rem;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;display:block;}
        .fg-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:11px 14px;color:var(--text);font-family:var(--font-mono);font-size:0.82rem;outline:none;transition:border-color 0.15s;letter-spacing:0.3px;}
        .fg-input:focus{border-color:var(--accent);}
        .fg-input::placeholder{color:var(--text3);}
        .fg-input.error{border-color:var(--mp);}
        .fg-error{font-family:var(--font-mono);font-size:0.65rem;color:var(--mp);margin-top:5px;}
        .fg-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
        .input-icon-wrap{position:relative;}
        .input-icon-wrap .fg-input{padding-right:40px;}
        .input-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text3);cursor:pointer;font-size:0.8rem;padding:0;}
        .input-toggle:hover{color:var(--text2);}
        .forgot{font-family:var(--font-mono);font-size:0.65rem;color:var(--text3);text-align:right;margin-top:6px;cursor:pointer;letter-spacing:0.3px;transition:color 0.15s;}
        .forgot:hover{color:var(--accent);}
        .btn-main{width:100%;padding:13px;border:none;border-radius:7px;background:var(--accent);color:#08080d;font-family:var(--font-mono);font-size:0.78rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all 0.2s;margin-top:6px;}
        .btn-main:hover{box-shadow:0 0 24px var(--accent-glow);transform:translateY(-1px);}
        .btn-main:disabled{opacity:0.4;cursor:not-allowed;transform:none;box-shadow:none;}
        .auth-note{font-size:0.75rem;color:var(--text3);text-align:center;margin-top:16px;line-height:1.6;}
        .auth-note a{color:var(--text2);cursor:pointer;text-decoration:underline;transition:color 0.15s;}
        .auth-note a:hover{color:var(--accent);}
        .reg-progress{display:flex;gap:6px;margin-bottom:24px;}
        .rp-step{flex:1;height:3px;border-radius:2px;background:var(--border);transition:background 0.3s;}
        .rp-step.done{background:var(--nm);}
        .rp-step.active{background:var(--accent);}
        .reg-step-title{font-family:var(--font-display);font-size:1.6rem;letter-spacing:1px;margin-bottom:4px;}
        .reg-step-sub{font-family:var(--font-mono);font-size:0.65rem;color:var(--text3);letter-spacing:1px;margin-bottom:20px;}
        .type-selector{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;}
        .type-opt{padding:16px;border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:all 0.15s;text-align:center;}
        .type-opt:hover{border-color:var(--border2);background:var(--surface2);}
        .type-opt.selected{border-color:var(--accent);background:var(--accent-dim);}
        .to-icon{font-size:1.8rem;margin-bottom:8px;}
        .to-title{font-family:var(--font-display);font-size:1rem;letter-spacing:0.5px;margin-bottom:4px;}
        .to-desc{font-size:0.72rem;color:var(--text2);font-weight:300;line-height:1.4;}
        .age-check{display:flex;align-items:flex-start;gap:10px;padding:14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;cursor:pointer;margin-bottom:10px;transition:all 0.15s;}
        .age-check:hover{border-color:var(--border2);}
        .age-check.selected{border-color:var(--accent);background:var(--accent-dim);}
        .ac-radio{width:18px;height:18px;border-radius:50%;border:2px solid var(--border2);flex-shrink:0;margin-top:1px;transition:all 0.15s;display:flex;align-items:center;justify-content:center;}
        .age-check.selected .ac-radio{border-color:var(--accent);background:var(--accent);}
        .ac-inner{width:6px;height:6px;border-radius:50%;background:#08080d;}
        .ac-title{font-size:0.85rem;font-weight:600;margin-bottom:2px;}
        .ac-desc{font-size:0.75rem;color:var(--text2);font-weight:300;line-height:1.4;}
        .minor-warning{padding:12px 14px;background:rgba(255,165,2,0.07);border:1px solid rgba(255,165,2,0.2);border-radius:7px;font-size:0.78rem;color:var(--lp);line-height:1.5;margin-top:10px;}
        .reg-nav{display:flex;justify-content:space-between;align-items:center;margin-top:20px;gap:10px;}
        .btn-back-sm{padding:10px 18px;border:1px solid var(--border);border-radius:6px;background:none;color:var(--text3);font-family:var(--font-mono);font-size:0.7rem;font-weight:600;letter-spacing:0.5px;cursor:pointer;transition:all 0.15s;text-transform:uppercase;}
        .btn-back-sm:hover{border-color:var(--border2);color:var(--text2);}
        .btn-next-sm{flex:1;padding:11px;border:none;border-radius:6px;background:var(--accent);color:#08080d;font-family:var(--font-mono);font-size:0.72rem;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all 0.15s;text-transform:uppercase;}
        .btn-next-sm:hover{box-shadow:0 0 18px var(--accent-glow);}
        .btn-next-sm:disabled{opacity:0.4;cursor:not-allowed;box-shadow:none;}
        .auth-success{text-align:center;padding:20px 0;}
        .as-icon{font-size:3rem;margin-bottom:16px;}
        .as-title{font-family:var(--font-display);font-size:2rem;letter-spacing:2px;margin-bottom:8px;}
        .as-sub{font-size:0.85rem;color:var(--text2);font-weight:300;line-height:1.6;margin-bottom:24px;}
        .terms-note{font-size:0.72rem;color:var(--text3);text-align:center;line-height:1.6;margin-top:14px;}
        .terms-note a{color:var(--text3);cursor:pointer;text-decoration:underline;}
        .terms-note a:hover{color:var(--text2);}
        select.fg-input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2355556a'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;cursor:pointer;}
        .reset-overlay{position:fixed;inset:0;background:rgba(8,8,13,0.88);backdrop-filter:blur(8px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity 0.2s;}
        .reset-overlay.open{opacity:1;pointer-events:all;}
        .reset-card{background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:28px;width:100%;max-width:380px;position:relative;}
        .reset-close{position:absolute;top:14px;right:14px;background:none;border:none;color:var(--text3);cursor:pointer;font-size:1.1rem;line-height:1;padding:4px;transition:color 0.15s;}
        .reset-close:hover{color:var(--text);}
        .reset-title{font-family:var(--font-display);font-size:1.5rem;letter-spacing:1px;margin-bottom:6px;}
        .reset-sub{font-size:0.8rem;color:var(--text2);font-weight:300;line-height:1.65;margin-bottom:20px;}
        .reset-success{text-align:center;padding:8px 0;}
        .rs-icon{font-size:2.5rem;margin-bottom:14px;}
        .rs-title{font-family:var(--font-display);font-size:1.4rem;letter-spacing:1px;margin-bottom:8px;}
        .rs-sub{font-size:0.8rem;color:var(--text2);line-height:1.7;}
        @media(max-width:800px){
          .auth-layout{grid-template-columns:1fr;}
          .auth-left{display:none;}
          .auth-right{padding:24px 18px;}
        }
      `}</style>

      <div className="auth-layout">

        {/* ===== LEFT — Branding ===== */}
        <div className="auth-left">
          <div className="al-glow" />
          <div className="al-glow2" />
          <div>
            <div className="al-tag">Únete a la comunidad</div>
            <div className="al-headline">
              TRADE<br /><span className="accent">SMARTER.</span>
            </div>
            <div className="al-sub">
              La nueva infraestructura del mercado TCG. Compra y vende con precios reales,
              envíos integrados y verificación de autenticidad.
            </div>
          </div>
          <div className="al-features">
            {[
              { icon: '📊', title: 'Precios reales de Cardmarket', desc: 'actualizados constantemente en EUR.' },
              { icon: '🔍', title: 'Verificación de autenticidad', desc: 'con pre-grading profesional.' },
              { icon: '📦', title: 'Envío integrado',              desc: 'con generación automática de etiquetas.' },
              { icon: '📷', title: 'Escáner IA',                   desc: '— identifica tu carta con una foto al instante.' },
            ].map(f => (
              <div className="al-feat" key={f.title}>
                <div className="af-icon">{f.icon}</div>
                <div className="af-text"><strong>{f.title}</strong> {f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== RIGHT — Forms ===== */}
        <div className="auth-right">
          <div className="auth-box">

            {/* TABS */}
            <div className="auth-tabs">
              <button className={`auth-tab${tab === 'login' ? ' active' : ''}`}
                onClick={() => setTab('login')}>
                Iniciar sesión
              </button>
              <button className={`auth-tab${tab === 'register' ? ' active' : ''}`}
                onClick={() => setTab('register')}>
                Registrarse
              </button>
            </div>

            {/* ========== LOGIN PANEL ========== */}
            {tab === 'login' && (
              <div>
                <div className="social-btns">
                  <button className="social-btn google" onClick={() => alert('Google — disponible próximamente')}>
                    <GoogleIcon /> Continuar con Google
                  </button>
                  <button className="social-btn apple" onClick={() => alert('Apple — disponible próximamente')}>
                    <AppleIcon /> Continuar con Apple
                  </button>
                </div>

                <div className="divider"><span>o con email</span></div>

                <div className="form-group">
                  <label className="fg-label">Email</label>
                  <input className="fg-input" type="email" placeholder="tu@email.com"
                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="fg-label">Contraseña</label>
                  <div className="input-icon-wrap">
                    <input className="fg-input" type={loginPassVis ? 'text' : 'password'}
                      placeholder="••••••••" value={loginPass}
                      onChange={e => setLoginPass(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && doLogin()} />
                    <button className="input-toggle"
                      onClick={() => setLoginPassVis(v => !v)}>
                      {loginPassVis ? '🙈' : '👁'}
                    </button>
                  </div>
                  <div className="forgot" onClick={openReset}>¿Olvidaste tu contraseña?</div>
                </div>

                <ErrorBox msg={loginError} />

                <button className="btn-main" disabled={loginLoading} onClick={doLogin}>
                  {loginLoading ? 'Entrando...' : 'Entrar'}
                </button>

                <div className="auth-note">
                  ¿No tienes cuenta? <a onClick={() => setTab('register')}>Regístrate gratis</a>
                </div>
              </div>
            )}

            {/* ========== REGISTER PANEL ========== */}
            {tab === 'register' && (
              <div>
                {/* Progress bar */}
                <div className="reg-progress">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`rp-step${stepDone(i) ? ' done' : ''}${stepActive(i) ? ' active' : ''}`} />
                  ))}
                </div>

                {/* ---- Step 1: Tipo de cuenta ---- */}
                {regStep === 1 && (
                  <div>
                    <div className="reg-step-title">CREA TU CUENTA</div>
                    <div className="reg-step-sub">Paso 1 de 4 · Tipo de cuenta</div>

                    <div className="social-btns">
                      <button className="social-btn google" onClick={() => alert('Google — disponible próximamente')}>
                        <GoogleIcon /> Registrarse con Google
                      </button>
                      <button className="social-btn apple" onClick={() => alert('Apple — disponible próximamente')}>
                        <AppleIcon /> Registrarse con Apple
                      </button>
                    </div>

                    <div className="divider"><span>o con email</span></div>

                    <div className="type-selector">
                      <div className={`type-opt${accountType === 'particular' ? ' selected' : ''}`}
                        onClick={() => setAccountType('particular')}>
                        <div className="to-icon">👤</div>
                        <div className="to-title">PARTICULAR</div>
                        <div className="to-desc">Coleccionista o vendedor individual</div>
                      </div>
                      <div className={`type-opt${accountType === 'empresa' ? ' selected' : ''}`}
                        onClick={() => setAccountType('empresa')}>
                        <div className="to-icon">🏪</div>
                        <div className="to-title">EMPRESA</div>
                        <div className="to-desc">Tienda, negocio o autónomo</div>
                      </div>
                    </div>

                    <div className="reg-nav">
                      <button className="btn-next-sm" disabled={!accountType}
                        onClick={() => setRegStep(2)}>
                        Continuar →
                      </button>
                    </div>
                    <div className="terms-note">
                      Al registrarte aceptas los <a>Términos de uso</a> y la <a>Política de privacidad</a>.
                    </div>
                  </div>
                )}

                {/* ---- Step 2: Datos personales / empresa ---- */}
                {regStep === 2 && (
                  <div>
                    <div className="reg-step-title">
                      {accountType === 'empresa' ? 'DATOS DE EMPRESA' : 'DATOS PERSONALES'}
                    </div>
                    <div className="reg-step-sub">
                      Paso 2 de 4 · {accountType === 'empresa' ? 'Información de negocio' : 'Información básica'}
                    </div>

                    {accountType === 'particular' ? (
                      <>
                        <div className="fg-row">
                          <div className="form-group">
                            <label className="fg-label">Nombre</label>
                            <input className="fg-input" type="text" placeholder="Juan"
                              value={firstName} onChange={e => setFirstName(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="fg-label">Apellidos</label>
                            <input className="fg-input" type="text" placeholder="García López"
                              value={lastName} onChange={e => setLastName(e.target.value)} />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="fg-label">Nombre de usuario</label>
                          <input className={`fg-input${usernameErr ? ' error' : ''}`}
                            type="text" placeholder="trainer_juan"
                            value={username}
                            onChange={e => { setUsername(e.target.value); validateUsername(e.target.value) }} />
                          {usernameErr && <div className="fg-error">{usernameErr}</div>}
                        </div>
                        <div className="form-group">
                          <label className="fg-label">Email</label>
                          <input className="fg-input" type="email" placeholder="tu@email.com"
                            value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="fg-label">Contraseña</label>
                          <div className="input-icon-wrap">
                            <input className="fg-input" type={regPassVis ? 'text' : 'password'}
                              placeholder="Mínimo 8 caracteres"
                              value={regPass} onChange={e => setRegPass(e.target.value)} />
                            <button className="input-toggle"
                              onClick={() => setRegPassVis(v => !v)}>
                              {regPassVis ? '🙈' : '👁'}
                            </button>
                          </div>
                          <PassStrength value={regPass} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="form-group">
                          <label className="fg-label">Razón social</label>
                          <input className="fg-input" type="text" placeholder="TCG Shop S.L."
                            value={companyName} onChange={e => setCompanyName(e.target.value)} />
                        </div>
                        <div className="fg-row">
                          <div className="form-group">
                            <label className="fg-label">CIF / NIF</label>
                            <input className="fg-input" type="text" placeholder="B12345678"
                              value={companyCIF} onChange={e => setCompanyCIF(e.target.value)} />
                          </div>
                          <div className="form-group">
                            <label className="fg-label">Tipo</label>
                            <select className="fg-input" value={companyType}
                              onChange={e => setCompanyType(e.target.value)}>
                              <option value="">Seleccionar...</option>
                              <option>S.L.</option>
                              <option>S.A.</option>
                              <option>Autónomo</option>
                              <option>S.C.</option>
                              <option>Otro</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="fg-label">Nombre comercial</label>
                          <input className="fg-input" type="text" placeholder="Nombre que verán los compradores"
                            value={tradeName} onChange={e => setTradeName(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="fg-label">Email de contacto</label>
                          <input className="fg-input" type="email" placeholder="tienda@email.com"
                            value={companyEmail} onChange={e => setCompanyEmail(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="fg-label">Teléfono</label>
                          <input className="fg-input" type="tel" placeholder="+34 600 000 000"
                            value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="fg-label">Contraseña</label>
                          <div className="input-icon-wrap">
                            <input className="fg-input" type={companyPassVis ? 'text' : 'password'}
                              placeholder="Mínimo 8 caracteres"
                              value={companyPass} onChange={e => setCompanyPass(e.target.value)} />
                            <button className="input-toggle"
                              onClick={() => setCompanyPassVis(v => !v)}>
                              {companyPassVis ? '🙈' : '👁'}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="reg-nav">
                      <button className="btn-back-sm" onClick={() => setRegStep(1)}>←</button>
                      <button className="btn-next-sm" onClick={() => setRegStep(3)}>Continuar →</button>
                    </div>
                  </div>
                )}

                {/* ---- Step 3: Dirección + edad ---- */}
                {regStep === 3 && (
                  <div>
                    <div className="reg-step-title">DIRECCIÓN DE ENVÍO</div>
                    <div className="reg-step-sub">Paso 3 de 4 · Ubicación y edad</div>

                    <div className="form-group">
                      <label className="fg-label">Calle y número</label>
                      <input className="fg-input" type="text" placeholder="Calle Mayor 42, 3ºA"
                        value={addrStreet} onChange={e => setAddrStreet(e.target.value)} />
                    </div>
                    <div className="fg-row">
                      <div className="form-group">
                        <label className="fg-label">Código postal</label>
                        <input className="fg-input" type="text" placeholder="28001" maxLength={5}
                          value={addrCP} onChange={e => setAddrCP(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="fg-label">Ciudad</label>
                        <input className="fg-input" type="text" placeholder="Madrid"
                          value={addrCity} onChange={e => setAddrCity(e.target.value)} />
                      </div>
                    </div>
                    <div className="fg-row">
                      <div className="form-group">
                        <label className="fg-label">Provincia</label>
                        <input className="fg-input" type="text" placeholder="Madrid"
                          value={addrProvince} onChange={e => setAddrProvince(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="fg-label">País</label>
                        <select className="fg-input" value={addrCountry}
                          onChange={e => setAddrCountry(e.target.value)}>
                          {['España','Portugal','Francia','Alemania','Italia','Países Bajos','Bélgica','Otro'].map(c => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ marginTop: '6px', marginBottom: '6px' }}>
                      <div className="fg-label" style={{ marginBottom: '10px' }}>Verificación de edad</div>
                      <div className={`age-check${ageType === 'adult' ? ' selected' : ''}`}
                        onClick={() => setAgeType('adult')}>
                        <div className="ac-radio">
                          {ageType === 'adult' && <div className="ac-inner" />}
                        </div>
                        <div>
                          <div className="ac-title">Tengo 18 años o más</div>
                          <div className="ac-desc">Acceso completo a todas las funciones de la plataforma.</div>
                        </div>
                      </div>
                      <div className={`age-check${ageType === 'minor' ? ' selected' : ''}`}
                        onClick={() => setAgeType('minor')}>
                        <div className="ac-radio">
                          {ageType === 'minor' && <div className="ac-inner" />}
                        </div>
                        <div>
                          <div className="ac-title">Tengo menos de 18 años</div>
                          <div className="ac-desc">Necesitarás autorización de un tutor legal para operar.</div>
                        </div>
                      </div>
                      {ageType === 'minor' && (
                        <div className="minor-warning">
                          ⚠️ Al ser menor de edad, tu tutor legal deberá firmar una autorización que te enviaremos por email antes de poder publicar o comprar cartas.
                        </div>
                      )}
                    </div>

                    <div className="reg-nav">
                      <button className="btn-back-sm" onClick={() => setRegStep(2)}>←</button>
                      <button className="btn-next-sm" onClick={() => setRegStep(4)}>Continuar →</button>
                    </div>
                  </div>
                )}

                {/* ---- Step 4: Confirmación ---- */}
                {regStep === 4 && (
                  <div>
                    <div className="reg-step-title">CASI LISTO</div>
                    <div className="reg-step-sub">Paso 4 de 4 · Confirmar registro</div>

                    {/* Extra datos fiscales empresa */}
                    {accountType === 'empresa' && (
                      <>
                        <div className="form-group">
                          <label className="fg-label">Dirección fiscal (si difiere)</label>
                          <input className="fg-input" type="text"
                            placeholder="Igual que dirección de envío si coincide"
                            value={fiscalAddr} onChange={e => setFiscalAddr(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="fg-label">IBAN (para cobros)</label>
                          <input className="fg-input" type="text"
                            placeholder="ES00 0000 0000 0000 0000 0000"
                            value={companyIBAN} onChange={e => setCompanyIBAN(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="fg-label">Número de registro mercantil (opcional)</label>
                          <input className="fg-input" type="text"
                            placeholder="Tomo X, Folio X, Hoja M-XXXXX"
                            value={regMercantil} onChange={e => setRegMercantil(e.target.value)} />
                        </div>
                      </>
                    )}

                    {/* Summary */}
                    <div style={{
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: '8px', padding: '16px', marginBottom: '16px',
                    }}>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)',
                        letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '12px',
                      }}>Resumen del registro</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px',
                        fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                        {regSummaryRows.map(([label, val]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text3)' }}>{label}</span>
                            <span style={{ color: 'var(--text)' }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Terms checkbox */}
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '6px' }}>
                      <input type="checkbox" id="acceptTerms"
                        checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)}
                        style={{ marginTop: '3px', accentColor: 'var(--accent)', width: '15px', height: '15px', flexShrink: 0, cursor: 'pointer' }} />
                      <label htmlFor="acceptTerms" style={{ fontSize: '0.78rem', color: 'var(--text2)', lineHeight: 1.5, cursor: 'pointer' }}>
                        Acepto los{' '}
                        <a style={{ color: 'var(--accent)', cursor: 'pointer' }}>Términos y Condiciones</a>,
                        la{' '}
                        <a style={{ color: 'var(--accent)', cursor: 'pointer' }}>Política de Privacidad</a>
                        {' '}y la{' '}
                        <a style={{ color: 'var(--accent)', cursor: 'pointer' }}>Política de Cookies</a>{' '}
                        de Pple.tcg
                      </label>
                    </div>

                    <ErrorBox msg={regError} />

                    <div className="reg-nav">
                      <button className="btn-back-sm" onClick={() => setRegStep(3)}>←</button>
                      <button className="btn-next-sm" disabled={regLoading}
                        onClick={doFinishRegister}>
                        {regLoading ? 'Creando cuenta...' : 'Crear cuenta ✓'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ---- Step 5: Success ---- */}
                {regStep === 5 && (
                  <div className="auth-success">
                    <div className="as-icon">🎉</div>
                    <div className="as-title">¡BIENVENIDO!</div>
                    <div className="as-sub">
                      Tu cuenta ha sido creada correctamente.<br />
                      Confirma tu email en{' '}
                      <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                        {successEmail}
                      </span>{' '}
                      para acceder.
                    </div>
                    <button className="btn-main" onClick={() => router.push('/')}>
                      Ir al mercado →
                    </button>
                  </div>
                )}

              </div>
            )}
            {/* end register panel */}

          </div>
        </div>
        {/* end auth-right */}

      </div>
      {/* end auth-layout */}

      {/* ========== RESET PASSWORD MODAL ========== */}
      <div className={`reset-overlay${resetOpen ? ' open' : ''}`}
        onClick={e => e.target === e.currentTarget && setResetOpen(false)}>
        <div className="reset-card">
          <button className="reset-close" onClick={() => setResetOpen(false)}>✕</button>

          {!resetSent ? (
            <>
              <div className="reset-title">RECUPERAR ACCESO</div>
              <div className="reset-sub">
                Introduce tu email y te enviaremos un enlace para restablecer tu contraseña.
              </div>
              <div className="form-group">
                <label className="fg-label">Email</label>
                <input className="fg-input" type="email" placeholder="tu@email.com"
                  value={resetEmail} onChange={e => setResetEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doSendReset()} />
              </div>
              <ErrorBox msg={resetError} />
              <button className="btn-main" disabled={resetLoading} onClick={doSendReset}>
                {resetLoading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </>
          ) : (
            <div className="reset-success">
              <div className="rs-icon">📬</div>
              <div className="rs-title">EMAIL ENVIADO</div>
              <div className="rs-sub">
                Revisa tu bandeja de entrada en<br />
                <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                  {resetEmail}
                </span>
                <br /><br />
                El enlace expira en 1 hora. Si no lo ves, revisa la carpeta de spam.
              </div>
            </div>
          )}
        </div>
      </div>

    </>
  )
}
