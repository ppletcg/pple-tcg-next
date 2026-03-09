'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const CONDITIONS_RAW = [
  { value: 'NM', label: 'NM', desc: 'Near Mint',         color: '#2ed573', bg: 'rgba(46,213,115,0.08)',  border: 'rgba(46,213,115,0.4)' },
  { value: 'LP', label: 'LP', desc: 'Lightly Played',    color: '#ffa502', bg: 'rgba(255,165,2,0.08)',   border: 'rgba(255,165,2,0.4)' },
  { value: 'MP', label: 'MP', desc: 'Mod. Played',       color: '#ff4757', bg: 'rgba(255,71,87,0.08)',   border: 'rgba(255,71,87,0.4)' },
]
const CONDITIONS_PSA = [
  { value: 'PSA10', label: 'PSA 10', desc: 'Gem Mint',   color: '#d4f53c', bg: 'rgba(212,245,60,0.08)',  border: 'rgba(212,245,60,0.4)' },
  { value: 'PSA9',  label: 'PSA 9',  desc: 'Mint',       color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.4)' },
  { value: 'PSA8',  label: 'PSA 8',  desc: 'NM-MT',      color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.4)' },
]

const SHIPPING = [
  { id: 'letter', label: 'Carta certificada', price: 1.80 },
  { id: 'small',  label: 'Paquete pequeño',   price: 3.50 },
  { id: 'medium', label: 'Paquete mediano',   price: 5.90 },
  { id: 'large',  label: 'Paquete grande',    price: 9.90 },
]

const s = {
  header:   { padding: '32px 40px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' },
  eyebrow:  { fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' },
  title:    { fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '2px', marginBottom: '6px' },
  sub:      { fontSize: '0.88rem', color: 'var(--text2)', fontWeight: 300, marginBottom: '24px' },
  stepsRow: { display: 'flex', gap: 0, marginBottom: '-1px' },
  main:     { maxWidth: '900px', margin: '0 auto', padding: '32px 40px 80px' },
  label:    { fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '7px', display: 'block' },
  input:    { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '11px 14px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', outline: 'none', letterSpacing: '0.3px', boxSizing: 'border-box' },
  textarea: { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '11px 14px', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: '0.85rem', outline: 'none', resize: 'vertical', minHeight: '80px', boxSizing: 'border-box' },
  btnAccent:{ padding: '11px 28px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1px', cursor: 'pointer', textTransform: 'uppercase' },
  btnBack:  { padding: '10px 20px', border: '1px solid var(--border)', borderRadius: '6px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.5px', cursor: 'pointer', textTransform: 'uppercase' },
}

function StepTab({ num, label, active, done }) {
  return (
    <div style={{
      padding: '10px 24px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '1px', textTransform: 'uppercase',
      color: done ? 'var(--nm)' : active ? 'var(--text)' : 'var(--text3)',
      border: '1px solid', borderBottom: active ? '1px solid var(--bg)' : '1px solid transparent',
      borderColor: active ? 'var(--border)' : 'transparent', borderRadius: '6px 6px 0 0',
      display: 'flex', alignItems: 'center', gap: '8px', background: active ? 'var(--bg)' : 'none',
    }}>
      <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: done ? 'var(--nm)' : active ? 'var(--accent)' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: (done || active) ? '#08080d' : 'var(--text3)', flexShrink: 0 }}>{done ? '✓' : num}</span>
      {label}
    </div>
  )
}

export default function VenderPage() {
  const router = useRouter()
  const [user, setUser]               = useState(null)
  const [step, setStep]               = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [cmPrices, setCmPrices]       = useState({}) // cardId -> trend price
  const [searching, setSearching]     = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [displayType, setDisplayType] = useState('raw')
  const [condition, setCondition]     = useState('')
  const [price, setPrice]             = useState('')
  const [suggestedPrice, setSuggestedPrice] = useState(null)
  const [psaCert, setPsaCert]         = useState('')
  const [description, setDescription] = useState('')
  const [shipping, setShipping]       = useState(null)
  const [submitting, setSubmitting]   = useState(false)
  const [success, setSuccess]         = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth')
      else setUser(user)
    })
  }, [router])

  const searchCards = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(q)}`)
      const data = await res.json()
      const cards = Array.isArray(data) ? data.slice(0, 8) : []
      setSearchResults(cards)
      // Fetch Cardmarket prices in background for each result
      cards.forEach(async card => {
        try {
          const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`)
          const d = await r.json()
          const p = d.pricing?.cardmarket?.trend || d.pricing?.cardmarket?.avg || d.pricing?.cardmarket?.low
          if (p) setCmPrices(prev => ({ ...prev, [card.id]: p }))
        } catch {}
      })
    } catch { setSearchResults([]) }
    setSearching(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchCards(searchQuery), 350)
    return () => clearTimeout(t)
  }, [searchQuery, searchCards])

  const selectCard = async (card) => {
    // Fetch full card details to get Cardmarket price
    let imgUrl = card.image ? `${card.image}/high.webp` : ''
    let cmPrice = cmPrices[card.id] || null
    try {
      const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${card.id}`)
      const d = await r.json()
      const p = d.pricing?.cardmarket?.trend || d.pricing?.cardmarket?.avg || d.pricing?.cardmarket?.low
      if (p) cmPrice = p
    } catch {}
    setSuggestedPrice(cmPrice)
    setSelectedCard({ id: card.id, name: card.name, set: card.set?.name || '', image: imgUrl })
    setSearchResults([])
    setSearchQuery(card.name)
    setCondition('')
    setStep(2)
  }

  const upsertPortfolioCard = async (sb, userId, card, cond, dtype) => {
    // Upsert profiles first
    await sb.from('profiles').upsert(
      { id: userId, username: user.email.split('@')[0] },
      { onConflict: 'id' }
    )
    // Check if entry already exists for this card + condition
    const { data: existing } = await sb.from('portfolio')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('card_id', card.id)
      .eq('condition', cond)
      .maybeSingle()

    if (existing) {
      await sb.from('portfolio').update({ quantity: (existing.quantity || 1) + 1, status: 'for_sale' }).eq('id', existing.id)
    } else {
      await sb.from('portfolio').insert({
        user_id: userId,
        card_id: card.id,
        card_name: card.name,
        card_set: card.set,
        card_image: card.image,
        condition: cond,
        display_type: dtype,
        paid_price: null,
        quantity: 1,
        status: 'for_sale',
      })
    }
  }

  const publish = async () => {
    if (!user || !selectedCard || !price) return
    if (displayType !== 'sealed' && !condition) return
    setSubmitting(true)
    const sb = createClient()
    await sb.from('profiles').upsert(
      { id: user.id, username: user.email.split('@')[0] },
      { onConflict: 'id' }
    )
    const { error } = await sb.from('listings').insert({
      seller_id: user.id,
      card_id: selectedCard.id,
      card_name: selectedCard.name,
      card_set: selectedCard.set,
      card_image: selectedCard.image,
      condition: displayType === 'sealed' ? null : condition,
      display_type: displayType,
      price: parseFloat(price),
      description: description || null,
      psa_cert: psaCert || null,
      sold: false,
    })
    if (!error) {
      // Auto-add to portfolio
      const effectiveCond = displayType === 'sealed' ? 'NM' : condition
      await upsertPortfolioCard(sb, user.id, selectedCard, effectiveCond, displayType)
      setSuccess(true)
    }
    setSubmitting(false)
  }

  const resetForm = () => {
    setSuccess(false); setStep(1); setSelectedCard(null); setSearchQuery('');
    setCondition(''); setPrice(''); setDescription(''); setPsaCert('');
    setDisplayType('raw'); setShipping(null); setSuggestedPrice(null);
  }

  const condList = displayType === 'slab' ? CONDITIONS_PSA : CONDITIONS_RAW
  const canGoStep3 = price && (displayType === 'sealed' || condition) && shipping
  const shippingObj = SHIPPING.find(s => s.id === shipping)

  if (success) {
    return (
      <div style={{ ...s.main, textAlign: 'center', paddingTop: '80px' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>✓</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', letterSpacing: '2px', color: 'var(--accent)', marginBottom: '10px' }}>¡PUBLICADO!</div>
        <div style={{ fontSize: '0.92rem', color: 'var(--text2)', fontWeight: 300, marginBottom: '8px' }}>Tu anuncio ya está visible en el marketplace.</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '32px' }}>La carta también se ha añadido a tu portfolio.</div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button style={s.btnBack} onClick={() => router.push('/')}>Ver marketplace</button>
          <button style={s.btnAccent} onClick={resetForm}>Publicar otra</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={s.header}>
        <div style={s.eyebrow}>Marketplace · Pokémon TCG</div>
        <div style={s.title}>PUBLICAR CARTA</div>
        <div style={s.sub}>Busca tu carta, fija el precio y empieza a vender.</div>
        <div style={s.stepsRow}>
          <StepTab num={1} label="Identificar carta"       active={step === 1} done={step > 1} />
          <StepTab num={2} label="Detalles del anuncio"    active={step === 2} done={step > 2} />
          <StepTab num={3} label="Confirmar y publicar"    active={step === 3} done={false} />
        </div>
      </div>

      <div style={s.main}>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '1px', marginBottom: '16px', color: 'var(--text2)' }}>BUSCAR CARTA</div>
            <label style={s.label}>Nombre de la carta</label>
            <input style={s.input} type="text" placeholder="Ej: Charizard ex, Pikachu, Mewtwo..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
            {searching && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)', marginTop: '8px' }}>Buscando...</div>}
            {searchResults.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto' }}>
                {searchResults.map(card => (
                  <div key={card.id} onClick={() => selectCard(card)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-dim)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface)' }}
                  >
                    {card.image && <img src={`${card.image}/high.webp`} alt={card.name} style={{ width: '36px', height: '50px', objectFit: 'contain', borderRadius: '4px', background: 'var(--surface2)' }} onError={e => e.target.style.display='none'} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '2px' }}>{card.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>{card.set?.name || ''} · {card.localId || card.id}</div>
                    </div>
                    {cmPrices[card.id] && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                        €{cmPrices[card.id].toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <div style={{ marginTop: '12px', padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', textAlign: 'center' }}>
                No se encontraron cartas con ese nombre.
              </div>
            )}
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && selectedCard && (
          <div>
            {/* Selected card bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '24px' }}>
              {selectedCard.image && <img src={selectedCard.image} alt={selectedCard.name} style={{ width: '44px', height: '62px', objectFit: 'contain', borderRadius: '5px', background: 'var(--surface2)' }} onError={e => e.target.style.display='none'} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.5px' }}>{selectedCard.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: '2px' }}>{selectedCard.set}</div>
              </div>
              {suggestedPrice && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text2)', textAlign: 'right' }}>
                  <div style={{ color: 'var(--text3)', fontSize: '0.58rem', marginBottom: '2px' }}>Cardmarket</div>
                  <div>€{suggestedPrice.toFixed(2)}</div>
                </div>
              )}
              <button style={{ padding: '6px 12px', border: '1px solid var(--border)', borderRadius: '5px', background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', cursor: 'pointer' }} onClick={() => setStep(1)}>Cambiar</button>
            </div>

            {/* Tipo */}
            <div style={{ marginBottom: '20px' }}>
              <label style={s.label}>Tipo de presentación</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {[
                  { v: 'raw',    icon: '🃏', label: 'RAW',     desc: 'Carta suelta sin graduar' },
                  { v: 'slab',   icon: '🏆', label: 'SLAB',    desc: 'Carta graduada PSA/CGC' },
                  { v: 'sealed', icon: '📦', label: 'SELLADO',  desc: 'Producto sellado / ETB' },
                ].map(opt => (
                  <div key={opt.v} onClick={() => { setDisplayType(opt.v); setCondition('') }}
                    style={{ padding: '14px', border: `1px solid ${displayType === opt.v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', background: displayType === opt.v ? 'var(--accent-dim)' : 'var(--surface)', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '1.4rem', marginBottom: '5px' }}>{opt.icon}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '1px', color: displayType === opt.v ? 'var(--accent)' : 'var(--text)', marginBottom: '3px' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text3)' }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Condición (raw/slab) */}
            {displayType !== 'sealed' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={s.label}>Condición</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {condList.map(c => (
                    <div key={c.value} onClick={() => setCondition(c.value)}
                      style={{ padding: '12px', border: `1px solid ${condition === c.value ? c.border : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'center', background: condition === c.value ? c.bg : 'var(--surface)', transition: 'all 0.15s' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '1px', color: c.color, marginBottom: '4px' }}>{c.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text2)', lineHeight: 1.4 }}>{c.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PSA cert */}
            {displayType === 'slab' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={s.label}>Número de certificado PSA (opcional)</label>
                <input style={s.input} type="text" placeholder="Ej: 12345678" value={psaCert} onChange={e => setPsaCert(e.target.value)} />
              </div>
            )}

            {/* Precio */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '7px' }}>
                <label style={{ ...s.label, marginBottom: 0 }}>Precio de venta</label>
                {suggestedPrice && (
                  <button onClick={() => setPrice(suggestedPrice.toFixed(2))}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', cursor: 'pointer', letterSpacing: '0.5px' }}>
                    Usar precio sugerido (€{suggestedPrice.toFixed(2)})
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text3)', pointerEvents: 'none' }}>€</span>
                <input style={{ ...s.input, paddingLeft: '28px', fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '1px' }} type="number" step="0.01" min="0.01" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)} />
              </div>
            </div>

            {/* Envío */}
            <div style={{ marginBottom: '20px' }}>
              <label style={s.label}>Método de envío</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {SHIPPING.map(sh => (
                  <div key={sh.id} onClick={() => setShipping(sh.id)}
                    style={{ padding: '12px 14px', border: `1px solid ${shipping === sh.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: shipping === sh.id ? 'var(--accent-dim)' : 'var(--surface)', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: '0.8rem', color: shipping === sh.id ? 'var(--accent)' : 'var(--text)' }}>{sh.label}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: shipping === sh.id ? 'var(--accent)' : 'var(--text2)' }}>€{sh.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Descripción */}
            <div style={{ marginBottom: '24px' }}>
              <label style={s.label}>Descripción (opcional)</label>
              <textarea style={s.textarea} placeholder="Estado de la carta, extras, etc." value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <button style={s.btnBack} onClick={() => setStep(1)}>← Volver</button>
              <button
                style={{ ...s.btnAccent, opacity: !canGoStep3 ? 0.4 : 1, cursor: !canGoStep3 ? 'not-allowed' : 'pointer' }}
                onClick={() => { if (canGoStep3) setStep(3) }}
                disabled={!canGoStep3}
              >
                Vista previa →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && selectedCard && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '24px' }}>
              {/* Card preview */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                <div style={{ width: '100%', height: '190px', background: 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {selectedCard.image
                    ? <img src={selectedCard.image} alt={selectedCard.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '6px' }} onError={e => e.target.style.display='none'} />
                    : <span style={{ fontSize: '3rem' }}>🎴</span>
                  }
                </div>
                <div style={{ padding: '14px' }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '1px', marginBottom: '2px' }}>{selectedCard.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginBottom: '10px' }}>{selectedCard.set}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '1px', color: 'var(--accent)' }}>€{parseFloat(price || 0).toFixed(2)}</div>
                  {suggestedPrice && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', marginTop: '4px' }}>Cardmarket: €{suggestedPrice.toFixed(2)}</div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '10px', paddingBottom: '6px', borderBottom: '1px solid var(--border)' }}>RESUMEN DEL ANUNCIO</div>
                {[
                  ['Carta',       selectedCard.name],
                  ['Colección',   selectedCard.set],
                  ['Tipo',        displayType === 'slab' ? 'SLAB' : displayType === 'sealed' ? 'SELLADO' : 'RAW'],
                  ...(displayType !== 'sealed' ? [['Condición', condition]] : []),
                  ['Precio',      `€${parseFloat(price || 0).toFixed(2)}`],
                  ['Envío',       shippingObj ? `${shippingObj.label} · €${shippingObj.price.toFixed(2)}` : '—'],
                  ...(psaCert    ? [['Cert. PSA',    psaCert]]      : []),
                  ...(description? [['Descripción',  description]]  : []),
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)', gap: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', flexShrink: 0 }}>{k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>{v}</span>
                  </div>
                ))}

                <div style={{ marginTop: '20px', padding: '14px', background: 'var(--nm-bg)', border: '1px solid rgba(46,213,115,0.2)', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--nm)' }}>
                  ✓ Tu anuncio será visible inmediatamente en el marketplace.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
              <button style={s.btnBack} onClick={() => setStep(2)}>← Volver</button>
              <button
                style={{ ...s.btnAccent, opacity: submitting ? 0.5 : 1, cursor: submitting ? 'not-allowed' : 'pointer', padding: '11px 36px', fontSize: '0.82rem' }}
                onClick={publish}
                disabled={submitting}
              >
                {submitting ? 'Publicando...' : 'Publicar anuncio ✓'}
              </button>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
