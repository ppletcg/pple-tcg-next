'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SERVICES = [
  {
    id: 'ai',
    icon: '🤖',
    title: 'Verificación IA',
    subtitle: 'Automática · 24–48h',
    desc: 'Análisis automatizado con modelos de visión artificial entrenados específicamente en Pokémon TCG. Detecta cartas alteradas, reimpresiones y daños.',
    price: '2% del valor',
    features: ['Análisis de imagen por IA', 'Detección de alteraciones', 'Informe digital', 'Cobertura hasta €500'],
    color: '#38bdf8',
    colorBg: 'rgba(56,189,248,0.08)',
    colorBorder: 'rgba(56,189,248,0.2)',
  },
  {
    id: 'human',
    icon: '🔍',
    title: 'Verificación Humana',
    subtitle: 'Experto certificado · 2–4 días',
    desc: 'Revisión física por un experto certificado en coleccionismo. Autenticidad garantizada con certificado de verificación PPLE.',
    price: '5% del valor',
    features: ['Revisión física exhaustiva', 'Experto certificado', 'Certificado PPLE', 'Cobertura ilimitada'],
    color: '#d4f53c',
    colorBg: 'rgba(212,245,60,0.06)',
    colorBorder: 'rgba(212,245,60,0.25)',
    highlighted: true,
  },
  {
    id: 'pregrading',
    icon: '📊',
    title: 'Pre-Gradeo',
    subtitle: 'Valoración previa · 4–7 días',
    desc: 'Estimación del grado PSA antes de enviar a gradear oficialmente. Ideal para saber si tu carta merece el proceso completo.',
    price: '€15 fijo',
    features: ['Estimación de grado PSA', 'Análisis de centering', 'Estudio de superficie', 'Recomendación de envío'],
    color: '#a78bfa',
    colorBg: 'rgba(167,139,250,0.08)',
    colorBorder: 'rgba(167,139,250,0.2)',
  },
  {
    id: 'beckett',
    icon: '🏆',
    title: 'Gradeo Beckett',
    subtitle: 'BGS oficial · 3–6 semanas',
    desc: 'Gradeo oficial de Beckett Grading Services. El estándar de oro para coleccionistas serios. Slab protector y holographic label incluidos.',
    price: 'Desde €25',
    features: ['Grado BGS oficial', 'Sub-grades (4 categorías)', 'Slab protector BGS', 'Registro en base de datos Beckett'],
    color: '#f59e0b',
    colorBg: 'rgba(245,158,11,0.08)',
    colorBorder: 'rgba(245,158,11,0.2)',
  },
]

const STEPS = [
  { n: '01', title: 'Envíanos tu carta', desc: 'Empaqueta tu carta de forma segura con la guía de envío que te proporcionamos y envíala a nuestra dirección.' },
  { n: '02', title: 'Verificación', desc: 'Nuestro equipo o sistema IA analiza la carta según el servicio elegido y emite un informe detallado.' },
  { n: '03', title: 'Certificado', desc: 'Recibes tu certificado digital (o físico en el caso de BGS) con el resultado y la valoración de la carta.' },
  { n: '04', title: 'Devolución', desc: 'Te devolvemos la carta con su certificado en un plazo de 24–48h adicionales tras la verificación.' },
]

const COMPARISON = [
  ['Tiempo de respuesta', '24–48h', '2–4 días', '4–7 días', '3–6 semanas'],
  ['Revisión física', '❌', '✅', '✅', '✅'],
  ['Certificado digital', '✅', '✅', '✅', '✅'],
  ['Slab protector', '❌', '❌', '❌', '✅ BGS'],
  ['Detección IA', '✅', '✅', '✅', '❌'],
  ['Precio', '2%', '5%', '€15', 'Desde €25'],
  ['Cobertura máx.', '€500', 'Ilimitada', 'Ilimitada', 'Ilimitada'],
]

export default function VerificacionPage() {
  const router = useRouter()
  const [orderModal, setOrderModal] = useState(false)
  const [selectedService, setSelectedService] = useState(null)
  const [step, setStep] = useState(1)
  const [cardDesc, setCardDesc] = useState('')

  const openOrder = (serviceId) => {
    setSelectedService(serviceId)
    setStep(1)
    setCardDesc('')
    setOrderModal(true)
  }

  return (
    <>
      {/* Hero */}
      <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', padding: '64px 40px 56px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-120px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'radial-gradient(circle,rgba(212,245,60,0.04) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>Protege tu colección</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', letterSpacing: '4px', lineHeight: 1, marginBottom: '20px' }}>VERIFICACIÓN<br />& AUTENTICIDAD</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', color: 'var(--text2)', maxWidth: '580px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            Compra y vende con total confianza. Nuestros servicios de verificación garantizan que cada carta es auténtica antes de que llegue a tus manos.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => document.getElementById('servicios')?.scrollIntoView({ behavior: 'smooth' })}
              style={{ padding: '13px 28px', border: 'none', borderRadius: '8px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '2px', cursor: 'pointer' }}>
              VER SERVICIOS
            </button>
            <button onClick={() => router.push('/')}
              style={{ padding: '13px 28px', border: '1px solid var(--border2)', borderRadius: '8px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', cursor: 'pointer' }}>
              Explorar marketplace
            </button>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '48px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '3px', marginBottom: '8px' }}>CÓMO FUNCIONA</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>Proceso simple en 4 pasos</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ padding: '24px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '12px', position: 'relative' }}>
                {i < STEPS.length - 1 && (
                  <div style={{ position: 'absolute', top: '32px', right: '-10px', fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--border2)', zIndex: 1 }}>→</div>
                )}
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', letterSpacing: '1px', color: 'var(--accent)', opacity: 0.4, marginBottom: '12px' }}>{s.n}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px', marginBottom: '8px' }}>{s.title}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', lineHeight: 1.7 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Services */}
      <div id="servicios" style={{ padding: '56px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '3px', marginBottom: '8px' }}>NUESTROS SERVICIOS</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>Elige el nivel de verificación que necesitas</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {SERVICES.map(svc => (
            <div key={svc.id} style={{ background: 'var(--surface)', border: `1px solid ${svc.highlighted ? svc.colorBorder : 'var(--border)'}`, borderRadius: '14px', padding: '24px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
              {svc.highlighted && (
                <div style={{ position: 'absolute', top: '14px', right: '14px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.55rem', fontWeight: 700, padding: '3px 8px', borderRadius: '20px', letterSpacing: '1px' }}>MÁS POPULAR</div>
              )}
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>{svc.icon}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '1px', marginBottom: '4px', color: svc.color }}>{svc.title}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginBottom: '14px' }}>{svc.subtitle}</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text2)', lineHeight: 1.6, marginBottom: '20px', flex: 1 }}>{svc.desc}</div>
              <div style={{ marginBottom: '20px' }}>
                {svc.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0' }}>
                    <span style={{ color: svc.color, fontSize: '0.75rem' }}>✓</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text2)' }}>{f}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '1px', color: svc.color, marginBottom: '16px' }}>{svc.price}</div>
              <button onClick={() => openOrder(svc.id)}
                style={{ padding: '11px', border: svc.highlighted ? 'none' : `1px solid ${svc.colorBorder}`, borderRadius: '7px', background: svc.highlighted ? 'var(--accent)' : svc.colorBg, color: svc.highlighted ? '#08080d' : svc.color, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '1px' }}>
                Solicitar servicio
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '48px 40px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '3px' }}>COMPARATIVA</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 400 }}></th>
                  {SERVICES.map(svc => (
                    <th key={svc.id} style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid var(--border)', color: svc.color }}>
                      {svc.icon} {svc.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map(([label, ...vals]) => (
                  <tr key={label} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 16px', color: 'var(--text3)' }}>{label}</td>
                    {vals.map((v, i) => (
                      <td key={i} style={{ padding: '11px 16px', textAlign: 'center', color: v.startsWith('✅') ? '#2ed573' : v.startsWith('❌') ? '#ff4757' : 'var(--text)' }}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Address */}
      <div style={{ padding: '48px 40px 80px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '2px', marginBottom: '12px' }}>DIRECCIÓN DE ENVÍO</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', lineHeight: 2 }}>
              PPLE TCG Verification Center<br />
              Calle Mayor, 12<br />
              28013 Madrid, España<br />
              CIF: B-00000000
            </div>
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '1px', marginBottom: '12px' }}>INSTRUCCIONES DE ENVÍO</div>
            {['Incluye el formulario de solicitud impreso', 'Utiliza doble burbuja de protección', 'Envía siempre con certificado y seguro', 'Indica en el exterior: "PPLE VERIFICATION"'].map(item => (
              <div key={item} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>→</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text2)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order modal */}
      {orderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,13,0.88)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setOrderModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '460px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            {step === 1 && (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '2px', marginBottom: '8px' }}>SOLICITAR VERIFICACIÓN</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '24px' }}>
                  Servicio: {SERVICES.find(s => s.id === selectedService)?.title}
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', display: 'block', marginBottom: '8px' }}>DESCRIPCIÓN DE LA CARTA</label>
                  <textarea
                    value={cardDesc}
                    onChange={e => setCardDesc(e.target.value)}
                    placeholder="Ej: Charizard Base Set 1ª edición, Near Mint, sin rayones..."
                    rows={4}
                    style={{ width: '100%', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setOrderModal(false)}
                    style={{ flex: 1, padding: '11px', border: '1px solid var(--border)', borderRadius: '6px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={() => setStep(2)} disabled={!cardDesc.trim()}
                    style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '6px', background: cardDesc.trim() ? 'var(--accent)' : 'var(--surface2)', color: cardDesc.trim() ? '#08080d' : 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: cardDesc.trim() ? 'pointer' : 'default' }}>
                    Continuar →
                  </button>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '2px', marginBottom: '8px' }}>INSTRUCCIONES DE ENVÍO</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '20px' }}>Sigue estos pasos para enviarnos tu carta</div>
                {['Descarga e imprime el formulario de solicitud', 'Incluye el formulario dentro del paquete', 'Protege la carta con sleeve + top loader', 'Envía a: Calle Mayor 12, 28013 Madrid'].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px', padding: '12px', background: 'var(--bg2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '0.9rem', color: '#08080d', flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text2)', lineHeight: 1.5 }}>{item}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button onClick={() => setStep(1)}
                    style={{ flex: 1, padding: '11px', border: '1px solid var(--border)', borderRadius: '6px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>
                    ← Volver
                  </button>
                  <button onClick={() => setOrderModal(false)}
                    style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                    Entendido ✓
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
