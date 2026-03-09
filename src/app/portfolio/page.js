'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const COND_COLOR = { NM: '#2ed573', LP: '#ffa502', MP: '#ff4757', PSA10: '#d4f53c', PSA9: '#38bdf8', PSA8: '#a78bfa' }
const COND_BG   = { NM: 'rgba(46,213,115,0.1)', LP: 'rgba(255,165,2,0.1)', MP: 'rgba(255,71,87,0.1)', PSA10: 'rgba(212,245,60,0.1)', PSA9: 'rgba(56,189,248,0.1)', PSA8: 'rgba(167,139,250,0.1)' }

async function fetchCmPrice(cardId) {
  try {
    const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${cardId}`)
    const d = await r.json()
    return d.pricing?.cardmarket?.trend || d.pricing?.cardmarket?.avg || d.pricing?.cardmarket?.low || null
  } catch { return null }
}

function buildChartData(period, endVal) {
  const counts = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 }
  const n = counts[period] || 90
  const pts = []
  let v = endVal * (0.72 + Math.random() * 0.18)
  for (let i = 0; i < n; i++) {
    v += (Math.random() - 0.46) * endVal * 0.025
    v = Math.max(v, endVal * 0.05)
    pts.push(v)
  }
  pts[pts.length - 1] = endVal
  return pts
}

function PortfolioChart({ totalVal, period }) {
  const W = 800, H = 180
  const PAD = { t: 20, b: 30, l: 58, r: 16 }
  const pts = buildChartData(period, totalVal || 100)
  const min = Math.min(...pts), max = Math.max(...pts)
  const range = max - min || 1
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b
  const xs = pts.map((_, i) => PAD.l + (i / (pts.length - 1)) * innerW)
  const ys = pts.map(v => PAD.t + (1 - (v - min) / range) * innerH)
  const positive = pts[pts.length - 1] >= pts[0]
  const color = positive ? '#2ed573' : '#ff4757'
  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ')
  const areaD = `${pathD} L${xs[xs.length-1].toFixed(1)},${(H-PAD.b).toFixed(1)} L${PAD.l},${(H-PAD.b).toFixed(1)} Z`
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD.t + f * innerH,
    val: max - f * range
  }))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="#22223a" strokeWidth="1" />
          <text x={PAD.l - 5} y={g.y + 4} textAnchor="end" fill="#55556a" fontSize="9" fontFamily="monospace">€{g.val.toFixed(0)}</text>
        </g>
      ))}
      <path d={areaD} fill="url(#chartGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={color} />
    </svg>
  )
}

export default function PortfolioPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [items, setItems] = useState([])
  const [listings, setListings] = useState([])
  const [cmPrices, setCmPrices] = useState({})
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('3m')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalStep, setModalStep] = useState(1)
  const [selCard, setSelCard] = useState(null)
  const [selType, setSelType] = useState('raw')
  const [selCond, setSelCond] = useState('NM')
  const [paidPrice, setPaidPrice] = useState('')
  const [cert, setCert] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [searchRes, setSearchRes] = useState([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  const sbRef = useRef(null)

  const loadData = useCallback(async (sb, userId) => {
    const [{ data: portfolio }, { data: lstgs }] = await Promise.all([
      sb.from('portfolio')
        .select('id, card_id, card_name, card_set, card_image, condition, display_type, paid_price, quantity, status, cert')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      sb.from('listings')
        .select('id, card_id, card_name, card_set, card_image, condition, price, display_type')
        .eq('seller_id', userId)
        .eq('sold', false)
        .order('created_at', { ascending: false }),
    ])
    const portfolioData = portfolio || []
    setItems(portfolioData)
    setListings(lstgs || [])
    setLoading(false)

    // Fetch Cardmarket prices for all unique cards in parallel
    const uniqueIds = [...new Set(portfolioData.map(i => i.card_id))]
    const entries = await Promise.all(uniqueIds.map(async id => [id, await fetchCmPrice(id)]))
    const prices = {}
    for (const [id, p] of entries) if (p !== null) prices[id] = p
    setCmPrices(prices)
  }, [])

  useEffect(() => {
    const sb = createClient()
    sbRef.current = sb
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      loadData(sb, user.id)
    })
  }, [router, loadData])

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!searchQ || searchQ.length < 2) { setSearchRes([]); return }
      setSearching(true)
      try {
        const r = await fetch(`https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(searchQ)}`)
        const d = await r.json()
        setSearchRes(Array.isArray(d) ? d.slice(0, 6) : [])
      } catch { setSearchRes([]) }
      setSearching(false)
    }, 350)
    return () => clearTimeout(t)
  }, [searchQ])

  const openModal = (type = 'raw') => {
    setSelType(type)
    setSelCond(type === 'slab' ? 'PSA10' : 'NM')
    setModalStep(1)
    setSelCard(null)
    setSearchQ('')
    setSearchRes([])
    setPaidPrice('')
    setCert('')
    setModalOpen(true)
  }

  const selectModalCard = (card) => {
    setSelCard({ id: card.id, name: card.name, set: card.set?.name || '', image: card.image ? `${card.image}/high.webp` : '' })
    setSearchQ(card.name)
    setSearchRes([])
  }

  const saveCard = async () => {
    if (!selCard || !user) return
    setSaving(true)
    const sb = sbRef.current
    await sb.from('profiles').upsert(
      { id: user.id, username: user.email.split('@')[0] },
      { onConflict: 'id' }
    )
    await sb.from('portfolio').insert({
      user_id: user.id,
      card_id: selCard.id,
      card_name: selCard.name,
      card_set: selCard.set,
      card_image: selCard.image,
      condition: selType === 'sealed' ? 'NM' : selCond,
      display_type: selType,
      paid_price: paidPrice ? parseFloat(paidPrice) : null,
      quantity: 1,
      status: 'owned',
      cert: cert || null,
    })
    setSaving(false)
    setModalOpen(false)
    loadData(sb, user.id)
  }

  const raw    = items.filter(i => i.display_type === 'raw')
  const slabs  = items.filter(i => i.display_type === 'slab')
  const sealed = items.filter(i => i.display_type === 'sealed')
  const getMP  = (item) => cmPrices[item.card_id] || null

  const rawVal    = raw.reduce((s, i) => s + (getMP(i) ?? (i.paid_price ? parseFloat(i.paid_price) : 0)) * (i.quantity || 1), 0)
  const slabVal   = slabs.reduce((s, i) => s + (getMP(i) ?? (i.paid_price ? parseFloat(i.paid_price) : 0)) * (i.quantity || 1), 0)
  const sealedVal = sealed.reduce((s, i) => s + (getMP(i) ?? (i.paid_price ? parseFloat(i.paid_price) : 0)) * (i.quantity || 1), 0)
  const totalVal  = rawVal + slabVal + sealedVal
  const totalCost = items.reduce((s, i) => s + (i.paid_price ? parseFloat(i.paid_price) * (i.quantity || 1) : 0), 0)
  const pnl       = totalVal - totalCost
  const forSaleVal = listings.reduce((s, l) => s + parseFloat(l.price || 0), 0)

  if (loading) return (
    <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>
      Cargando portfolio...
    </div>
  )

  const condOpts = selType === 'slab' ? ['PSA10','PSA9','PSA8'] : ['NM','LP','MP']

  return (
    <>
      {/* Page header */}
      <div style={{ padding: '32px 40px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Mi colección · Actualizado hoy</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', letterSpacing: '2px', lineHeight: 1, marginBottom: '4px' }}>PORTFOLIO</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', letterSpacing: '1px' }}>{user?.email?.split('@')[0]}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ padding: '8px 16px', border: '1px solid var(--border2)', borderRadius: '6px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>Exportar CSV</button>
          <button onClick={() => openModal('raw')} style={{ padding: '8px 18px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}>+ Añadir</button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 40px 80px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '24px' }}>
          {[
            { label: 'Valor total',  val: `€${totalVal.toFixed(0)}`,   sub: null, color: 'var(--accent)', highlight: true },
            { label: 'RAW',          val: `€${rawVal.toFixed(0)}`,     sub: `${raw.length} cartas`,    color: 'var(--text)' },
            { label: 'Slabs PSA',    val: `€${slabVal.toFixed(0)}`,    sub: `${slabs.length} slabs`,   color: 'var(--text)' },
            { label: 'Sellado',      val: `€${sealedVal.toFixed(0)}`,  sub: `${sealed.length} items`,  color: 'var(--text)' },
            { label: 'En venta',     val: `€${forSaleVal.toFixed(0)}`, sub: `${listings.length} anuncios`, color: 'var(--nm)' },
            { label: 'Coste total',  val: `€${totalCost.toFixed(0)}`,  sub: pnl !== 0 ? `P&L ${pnl >= 0 ? '+' : ''}€${pnl.toFixed(0)}` : null, color: 'var(--text)' },
          ].map((k, i) => (
            <div key={i} style={{ background: k.highlight ? 'var(--accent-dim)' : 'var(--surface)', border: `1px solid ${k.highlight ? 'rgba(212,245,60,0.2)' : 'var(--border)'}`, borderRadius: '10px', padding: '16px 18px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '1px', lineHeight: 1, color: k.color }}>{k.val}</div>
              {k.sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', marginTop: '4px' }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px 24px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase' }}>Evolución del portfolio</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {['1m','3m','6m','1y'].map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{ padding: '4px 10px', border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '4px', background: period === p ? 'var(--accent-dim)' : 'none', color: period === p ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', cursor: 'pointer', textTransform: 'uppercase' }}>{p}</button>
              ))}
            </div>
          </div>
          <div style={{ height: '180px', width: '100%' }}>
            <PortfolioChart totalVal={totalVal} period={period} />
          </div>
        </div>

        {/* MIS ANUNCIOS */}
        <Section title="MIS ANUNCIOS" count={`${listings.length} activos`} value={listings.length > 0 ? `€${forSaleVal.toFixed(0)}` : null} onAdd={() => router.push('/vender')} addLabel="+ Publicar">
          {listings.length === 0
            ? <EmptyState msg="No tienes anuncios activos" onClick={() => router.push('/vender')} />
            : <Grid>{listings.map(l => <ListingCard key={l.id} l={l} onClick={() => router.push(`/checkout?listing_id=${l.id}`)} />)}</Grid>
          }
        </Section>

        {/* RAW */}
        <Section title="RAW" count={`${raw.length} cartas`} value={rawVal > 0 ? `€${rawVal.toFixed(0)}` : null} onAdd={() => openModal('raw')}>
          {raw.length === 0
            ? <EmptyState msg="Añade tu primera carta raw" onClick={() => openModal('raw')} />
            : <Grid>{raw.map(c => <PortfolioCard key={c.id} c={c} mp={getMP(c)} />)}</Grid>
          }
        </Section>

        {/* SLABS PSA */}
        <Section title="SLABS PSA" count={`${slabs.length} slabs`} value={slabVal > 0 ? `€${slabVal.toFixed(0)}` : null} onAdd={() => openModal('slab')}>
          {slabs.length === 0
            ? <EmptyState msg="Añade tu primer slab PSA" onClick={() => openModal('slab')} />
            : <Grid>{slabs.map(c => <PortfolioCard key={c.id} c={c} mp={getMP(c)} />)}</Grid>
          }
        </Section>

        {/* PRODUCTO SELLADO */}
        <Section title="PRODUCTO SELLADO" count={`${sealed.length} items`} value={sealedVal > 0 ? `€${sealedVal.toFixed(0)}` : null} onAdd={() => openModal('sealed')}>
          {sealed.length === 0
            ? <EmptyState msg="Añade producto sellado" onClick={() => openModal('sealed')} />
            : <Grid>{sealed.map(c => <PortfolioCard key={c.id} c={c} mp={getMP(c)} />)}</Grid>
          }
        </Section>

      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,8,0.92)', backdropFilter: 'blur(16px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '28px' }}>

            {/* STEP 1 — Búsqueda */}
            {modalStep === 1 && (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '1px', marginBottom: '4px' }}>AÑADIR CARTA</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '20px' }}>Busca la carta por nombre</div>

                <label style={lbl}>Nombre de la carta</label>
                <input style={inp} type="text" placeholder="Buscar..." value={searchQ} onChange={e => { setSearchQ(e.target.value); setSelCard(null) }} autoFocus />
                {searching && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: '6px' }}>Buscando...</div>}

                {searchRes.length > 0 && !selCard && (
                  <div style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {searchRes.map(c => (
                      <div key={c.id} onClick={() => selectModalCard(c)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        {c.image && <img src={`${c.image}/low.webp`} alt={c.name} style={{ width: '28px', height: '38px', objectFit: 'contain', borderRadius: '3px' }} onError={e => e.target.style.display='none'} />}
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '1px' }}>{c.name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>{c.set?.name || ''}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selCard && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--accent-dim)', border: '1px solid rgba(212,245,60,0.3)', borderRadius: '6px', marginTop: '8px' }}>
                    {selCard.image && <img src={selCard.image} alt={selCard.name} style={{ width: '28px', height: '38px', objectFit: 'contain' }} onError={e => e.target.style.display='none'} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>{selCard.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>{selCard.set}</div>
                    </div>
                    <button onClick={() => { setSelCard(null); setSearchQ('') }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                  <button onClick={() => setModalOpen(false)} style={btnCancel}>Cancelar</button>
                  <button onClick={() => setModalStep(2)} disabled={!selCard}
                    style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: selCard ? 'pointer' : 'not-allowed', opacity: selCard ? 1 : 0.4, textTransform: 'uppercase' }}>
                    Continuar →
                  </button>
                </div>
              </>
            )}

            {/* STEP 2 — Clasificar */}
            {modalStep === 2 && selCard && (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '1px', marginBottom: '14px' }}>CLASIFICAR</div>

                {/* Preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '18px' }}>
                  {selCard.image && <img src={selCard.image} alt={selCard.name} style={{ width: '32px', height: '44px', objectFit: 'contain', borderRadius: '3px' }} onError={e => e.target.style.display='none'} />}
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{selCard.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>{selCard.set}</div>
                  </div>
                </div>

                {/* Tipo */}
                <label style={lbl}>Tipo</label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                  {[{ v:'raw', l:'RAW' }, { v:'slab', l:'SLAB' }, { v:'sealed', l:'SELLADO' }].map(t => (
                    <button key={t.v} onClick={() => { setSelType(t.v); setSelCond(t.v === 'slab' ? 'PSA10' : 'NM') }}
                      style={{ flex: 1, padding: '8px', border: `1px solid ${selType === t.v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', background: selType === t.v ? 'var(--accent-dim)' : 'none', color: selType === t.v ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {t.l}
                    </button>
                  ))}
                </div>

                {/* Condición (solo raw/slab) */}
                {selType !== 'sealed' && (
                  <>
                    <label style={lbl}>Condición</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '14px' }}>
                      {condOpts.map(cv => (
                        <div key={cv} onClick={() => setSelCond(cv)}
                          style={{ padding: '8px', border: `1px solid ${selCond === cv ? (COND_COLOR[cv] || 'var(--accent)') : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'center', background: selCond === cv ? (COND_BG[cv] || 'var(--accent-dim)') : 'var(--bg2)', transition: 'all 0.15s' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: COND_COLOR[cv] || 'var(--text)' }}>{cv}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Certificado (solo slab) */}
                {selType === 'slab' && (
                  <div style={{ marginBottom: '14px' }}>
                    <label style={lbl}>Número de certificado (opcional)</label>
                    <input style={inp} type="text" placeholder="Ej: 12345678" value={cert} onChange={e => setCert(e.target.value)} />
                  </div>
                )}

                {/* Precio pagado */}
                <label style={lbl}>Precio pagado (opcional)</label>
                <div style={{ position: 'relative', marginBottom: '20px' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }}>€</span>
                  <input style={{ ...inp, paddingLeft: '24px' }} type="number" step="0.01" min="0" placeholder="0.00" value={paidPrice} onChange={e => setPaidPrice(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setModalStep(1)} style={btnCancel}>← Volver</button>
                  <button onClick={saveCard} disabled={saving}
                    style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {saving ? 'Guardando...' : 'Confirmar'}
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

const lbl = { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }
const inp = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }
const btnCancel = { flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }

function Section({ title, count, value, onAdd, addLabel = '+ Añadir', children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '1px' }}>{title}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '1px' }}>{count}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {value && <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--accent)' }}>{value}</div>}
          <button onClick={onAdd}
            style={{ padding: '6px 14px', border: '1px solid var(--border2)', borderRadius: '5px', background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.3px', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}
          >{addLabel}</button>
        </div>
      </div>
      {children}
    </div>
  )
}

function Grid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '10px' }}>{children}</div>
}

function EmptyState({ msg, onClick }) {
  return (
    <div onClick={onClick}
      style={{ padding: '32px', textAlign: 'center', border: '1.5px dashed var(--border)', borderRadius: '10px', cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ fontSize: '1.5rem', marginBottom: '10px', opacity: 0.4 }}>+</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>{msg}</div>
    </div>
  )
}

function PortfolioCard({ c, mp }) {
  const isSlab = c.display_type === 'slab'
  const color = COND_COLOR[c.condition] || 'var(--text2)'
  const bg    = COND_BG[c.condition] || 'transparent'
  const cost  = c.paid_price ? parseFloat(c.paid_price) : null
  const pnl   = (mp !== null && cost !== null) ? (mp - cost) : null

  return (
    <div
      style={{ background: 'var(--surface)', border: `1px solid ${c.status === 'for_sale' ? 'rgba(212,245,60,0.2)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      {c.status === 'for_sale' && <span style={{ position: 'absolute', top: '7px', right: '7px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '1px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>EN VENTA</span>}
      {(c.quantity || 1) > 1 && <span style={{ position: 'absolute', top: '7px', left: '7px', background: '#08080d', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(212,245,60,0.35)', zIndex: 1 }}>x{c.quantity}</span>}

      <div style={{ position: 'relative', width: '100%', height: '130px', background: isSlab ? 'linear-gradient(135deg,#1a1a0a,#2a2a10)' : 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {c.card_image
          ? <img src={c.card_image} alt={c.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} onError={e => e.target.style.display='none'} />
          : <span style={{ fontSize: '2rem' }}>🎴</span>
        }
        <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: bg, border: `1px solid ${color}`, color, fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '3px', letterSpacing: '0.5px' }}>{c.condition}</span>
      </div>

      <div style={{ padding: '10px 11px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '1px' }}>{c.card_name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', marginBottom: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.card_set}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {cost !== null && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.57rem', color: 'var(--text3)' }}>Coste €{cost.toFixed(2)}</div>}
          {mp !== null && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.57rem', color: 'var(--text2)' }}>Valor €{mp.toFixed(2)}</div>}
        </div>
        {pnl !== null && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: pnl >= 0 ? '#2ed573' : '#ff4757', marginTop: '3px' }}>
            {pnl >= 0 ? '+' : ''}€{pnl.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  )
}

function ListingCard({ l, onClick }) {
  const color = COND_COLOR[l.condition] || 'var(--text2)'
  return (
    <div onClick={onClick}
      style={{ background: 'var(--surface)', border: '1px solid rgba(212,245,60,0.15)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      <div style={{ width: '100%', height: '120px', background: 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {l.card_image
          ? <img src={l.card_image} alt={l.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} onError={e => e.target.style.display='none'} />
          : <span style={{ fontSize: '2rem' }}>🎴</span>
        }
        {l.condition && <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(0,0,0,0.7)', border: `1px solid ${color}`, color, fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>{l.condition}</span>}
      </div>
      <div style={{ padding: '9px 10px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '1px' }}>{l.card_name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', marginBottom: '6px' }}>{l.card_set}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--accent)' }}>€{parseFloat(l.price).toFixed(2)}</div>
      </div>
    </div>
  )
}
