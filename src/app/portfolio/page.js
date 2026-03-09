'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const COND_COLOR = { NM: '#2ed573', LP: '#ffa502', MP: '#ff4757', PSA10: '#d4f53c', PSA9: '#38bdf8', PSA8: '#a78bfa' }
const COND_BG   = { NM: 'rgba(46,213,115,0.15)', LP: 'rgba(255,165,2,0.15)', MP: 'rgba(255,71,87,0.15)', PSA10: 'rgba(212,245,60,0.2)', PSA9: 'rgba(56,189,248,0.15)', PSA8: 'rgba(167,139,250,0.15)' }

const PERIODS = {
  '1m': { points: 30,  labels: ['1 Feb','8 Feb','15 Feb','22 Feb','Hoy'] },
  '3m': { points: 90,  labels: ['Nov','Dic','Ene','Feb','Hoy'] },
  '6m': { points: 180, labels: ['Ago','Sep','Oct','Nov','Dic','Hoy'] },
  '1y': { points: 365, labels: ['Mar','May','Jul','Sep','Nov','Hoy'] },
}

async function fetchCmPrice(cardId) {
  if (!cardId) return null
  try {
    const r = await fetch(`https://api.tcgdex.net/v2/en/cards/${cardId}`)
    if (!r.ok) return null
    const d = await r.json()
    return d.pricing?.cardmarket?.trend || d.pricing?.cardmarket?.avg || d.pricing?.cardmarket?.low || null
  } catch { return null }
}

function buildChartData(period, endVal) {
  const n = PERIODS[period]?.points || 90
  const pts = []
  const startFactor = period === '1m' ? 0.88 : period === '3m' ? 0.72 : period === '6m' ? 0.58 : 0.42
  const startVal = endVal * startFactor
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const trend = startVal + (endVal - startVal) * Math.pow(t, 0.8)
    const noise = trend * (0.97 + Math.random() * 0.06)
    pts.push(i === n - 1 ? endVal : noise)
  }
  return pts
}

function PortfolioChart({ totalVal, period }) {
  const W = 1000, H = 180, padX = 8, padY = 16
  const pts = buildChartData(period, totalVal || 100)
  const mn = Math.min(...pts) * 0.97
  const mx = Math.max(...pts) * 1.03
  const range = mx - mn || 1
  const x = i => padX + (i / (pts.length - 1)) * (W - padX * 2)
  const y = v => H - padY - ((v - mn) / range) * (H - padY * 2)
  const positive = pts[pts.length - 1] >= pts[0]
  const col = positive ? '#2ed573' : '#ff4757'
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`
  const gridLines = [0, 1, 2, 3].map(i => ({
    yg: (padY + i * (H - padY * 2) / 3).toFixed(1),
    val: (mn + range * (1 - i / 3)).toFixed(0),
  }))
  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '180px' }}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity="0.18" />
            <stop offset="100%" stopColor={col} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {gridLines.map((g, i) => (
          <g key={i}>
            <line x1={padX} y1={g.yg} x2={W - padX} y2={g.yg} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={padX + 4} y={parseFloat(g.yg) - 4} fontFamily="DM Mono,monospace" fontSize="11" fill="rgba(255,255,255,0.2)">€{g.val}</text>
          </g>
        ))}
        <path d={area} fill="url(#chartGrad)" />
        <path d={line} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(pts.length - 1).toFixed(1)} cy={y(pts[pts.length - 1]).toFixed(1)} r="5" fill={col} stroke="#0e0e16" strokeWidth="2.5" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', padding: '0 2px' }}>
        {(PERIODS[period]?.labels || []).map((l, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '0.3px' }}>{l}</span>
        ))}
      </div>
    </div>
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

    // Fetch Cardmarket prices in parallel for all unique cards
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

  // Card search debounce
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
    setSelCard({
      id: card.id,
      name: card.name,
      set: card.set?.name || '',
      image: card.image ? `${card.image}/high.png` : '',
    })
    setSearchQ(card.name)
    setSearchRes([])
  }

  const saveCard = async () => {
    if (!selCard || !user) return
    setSaving(true)
    const sb = sbRef.current
    // RULE: upsert profiles BEFORE inserting in portfolio (FK constraint)
    await sb.from('profiles').upsert(
      { id: user.id, username: user.email?.split('@')[0] || user.id.slice(0, 8) },
      { onConflict: 'id' }
    )
    const { error } = await sb.from('portfolio').insert({
      user_id: user.id,
      card_id: String(selCard.id),
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
    if (!error) {
      setModalOpen(false)
      loadData(sb, user.id)
    }
  }

  const raw    = items.filter(i => i.display_type === 'raw')
  const slabs  = items.filter(i => i.display_type === 'slab')
  const sealed = items.filter(i => i.display_type === 'sealed')
  const getMP  = (item) => cmPrices[item.card_id] ?? null

  const rawVal    = raw.reduce((s, i)    => s + (getMP(i) ?? (i.paid_price ? parseFloat(i.paid_price) : 0)) * (i.quantity || 1), 0)
  const slabVal   = slabs.reduce((s, i)  => s + (getMP(i) ?? (i.paid_price ? parseFloat(i.paid_price) : 0)) * (i.quantity || 1), 0)
  const sealedVal = sealed.reduce((s, i) => s + (getMP(i) ?? (i.paid_price ? parseFloat(i.paid_price) : 0)) * (i.quantity || 1), 0)
  const totalVal  = rawVal + slabVal + sealedVal
  const totalCost = items.reduce((s, i)  => s + (i.paid_price ? parseFloat(i.paid_price) * (i.quantity || 1) : 0), 0)
  const pnl       = totalVal - totalCost
  const forSaleVal = listings.reduce((s, l) => s + parseFloat(l.price || 0), 0)

  const condOpts = selType === 'slab' ? ['PSA10', 'PSA9', 'PSA8'] : ['NM', 'LP', 'MP']

  if (loading) return (
    <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', letterSpacing: '2px' }}>
      Cargando portfolio...
    </div>
  )

  return (
    <>
      {/* Page header */}
      <div style={{ padding: '32px 40px 28px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--accent)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px' }}>Mi colección · Actualizado hoy</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.8rem', letterSpacing: '2px', lineHeight: 1, marginBottom: '4px' }}>PORTFOLIO</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', letterSpacing: '1px' }}>{user?.email}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button style={{ padding: '8px 16px', border: '1px solid var(--border2)', borderRadius: '6px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exportar CSV</button>
          <button onClick={() => openModal('raw')} style={{ padding: '8px 18px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>+ Añadir</button>
        </div>
      </div>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '28px 40px 80px' }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '24px' }}>
          {[
            {
              label: 'Valor total',
              val: `€${totalVal.toFixed(2)}`,
              sub: totalCost > 0 ? `▲ +${((pnl / totalCost) * 100).toFixed(1)}% desde coste` : '—',
              subColor: pnl >= 0 ? 'var(--nm)' : 'var(--mp)',
              color: 'var(--accent)',
              highlight: true,
            },
            { label: 'RAW',       val: `€${rawVal.toFixed(2)}`,    sub: `${raw.length} cartas`,       subColor: 'var(--text3)', color: 'var(--text)' },
            { label: 'Slabs PSA', val: `€${slabVal.toFixed(2)}`,   sub: `${slabs.length} slabs`,      subColor: 'var(--text3)', color: 'var(--text)' },
            { label: 'Sellado',   val: `€${sealedVal.toFixed(2)}`, sub: `${sealed.length} items`,     subColor: 'var(--text3)', color: 'var(--text)' },
            { label: 'En venta',  val: `€${forSaleVal.toFixed(2)}`,sub: `${listings.length} anuncios`,subColor: 'var(--text3)', color: 'var(--nm)' },
            {
              label: 'Coste total',
              val: `€${totalCost.toFixed(2)}`,
              sub: pnl !== 0 ? `${pnl >= 0 ? '▲ +' : '▼ '}€${Math.abs(pnl).toFixed(2)} P&L` : '—',
              subColor: pnl >= 0 ? 'var(--nm)' : 'var(--mp)',
              color: 'var(--text)',
            },
          ].map((k, i) => (
            <div key={i} style={{ background: k.highlight ? 'var(--accent-dim)' : 'var(--surface)', border: `1px solid ${k.highlight ? 'rgba(212,245,60,0.2)' : 'var(--border)'}`, borderRadius: '10px', padding: '16px 18px' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>{k.label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', letterSpacing: '1px', lineHeight: 1, color: k.color }}>{k.val}</div>
              {k.sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: k.subColor, marginTop: '5px' }}>{k.sub}</div>}
            </div>
          ))}
        </div>

        {/* Chart */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '1px' }}>EVOLUCIÓN DEL PORTFOLIO</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: '2px', letterSpacing: '0.5px' }}>Valor total estimado basado en precios de Cardmarket</div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[['1m','1M'],['3m','3M'],['6m','6M'],['1y','1A']].map(([p, l]) => (
                <button key={p} onClick={() => setPeriod(p)}
                  style={{ padding: '4px 12px', borderRadius: '4px', border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`, background: period === p ? 'var(--accent)' : 'none', color: period === p ? '#08080d' : 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: period === p ? 700 : 400, cursor: 'pointer', letterSpacing: '0.3px' }}
                >{l}</button>
              ))}
            </div>
          </div>
          <PortfolioChart totalVal={totalVal} period={period} />
        </div>

        {/* MIS ANUNCIOS */}
        <Section
          title="MIS ANUNCIOS"
          icon={{ bg: 'var(--accent-dim)', border: 'rgba(212,245,60,0.2)', emoji: '📌' }}
          count={`${listings.length} anuncios`}
          value={listings.length > 0 ? `€${forSaleVal.toFixed(2)}` : null}
          onAdd={() => router.push('/vender')}
          addLabel="+ Publicar"
        >
          {listings.length === 0
            ? <EmptyState title="Sin anuncios activos" sub="Publica tu primera carta para vender" onClick={() => router.push('/vender')} />
            : <CardsGrid>{listings.map(l => <ListingCard key={l.id} l={l} onClick={() => router.push(`/checkout?listing_id=${l.id}`)} />)}</CardsGrid>
          }
        </Section>

        {/* RAW */}
        <Section
          title="RAW"
          icon={{ bg: 'rgba(46,213,115,0.08)', border: 'rgba(46,213,115,0.2)', emoji: '🃏' }}
          count={`${raw.length} cartas`}
          value={rawVal > 0 ? `€${rawVal.toFixed(2)}` : null}
          onAdd={() => openModal('raw')}
        >
          {raw.length === 0
            ? <EmptyState title="Añade tu primera carta RAW" sub="Escanea o busca manualmente" onClick={() => openModal('raw')} />
            : <CardsGrid>{raw.map(c => <PortfolioCard key={c.id} c={c} mp={getMP(c)} />)}</CardsGrid>
          }
        </Section>

        {/* SLABS PSA */}
        <Section
          title="SLABS PSA"
          icon={{ bg: 'rgba(212,245,60,0.07)', border: 'rgba(212,245,60,0.15)', emoji: '🏆' }}
          count={`${slabs.length} slabs`}
          value={slabVal > 0 ? `€${slabVal.toFixed(2)}` : null}
          onAdd={() => openModal('slab')}
        >
          {slabs.length === 0
            ? <EmptyState title="Añade tu primera slab PSA" sub="Declara el grado y número de certificado" onClick={() => openModal('slab')} />
            : <CardsGrid>{slabs.map(c => <PortfolioCard key={c.id} c={c} mp={getMP(c)} />)}</CardsGrid>
          }
        </Section>

        {/* PRODUCTO SELLADO */}
        <Section
          title="PRODUCTO SELLADO"
          icon={{ bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', emoji: '📦' }}
          count={`${sealed.length} items`}
          value={sealedVal > 0 ? `€${sealedVal.toFixed(2)}` : null}
          onAdd={() => openModal('sealed')}
        >
          {sealed.length === 0
            ? <EmptyState title="Añade producto sellado" sub="Displays, ETBs, Booster Boxes..." onClick={() => openModal('sealed')} />
            : <SealedGrid>{sealed.map(c => <SealedCard key={c.id} c={c} mp={getMP(c)} />)}</SealedGrid>
          }
        </Section>

        {/* WISHLIST */}
        <Section
          title="WISHLIST"
          icon={{ bg: 'rgba(255,71,87,0.08)', border: 'rgba(255,71,87,0.15)', emoji: '❤️' }}
          count="0 cartas buscadas"
          value={null}
          onAdd={() => {}}
        >
          <EmptyState title="Tu wishlist está vacía" sub="Añade cartas que estés buscando a buen precio" onClick={() => {}} />
        </Section>

      </div>

      {/* Add / Classify Modal */}
      {modalOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(4,4,8,0.9)', backdropFilter: 'blur(16px)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '28px', animation: 'mIn 0.2s ease' }}>

            {/* STEP 1 — Search */}
            {modalStep === 1 && (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '1px', marginBottom: '4px' }}>
                  {selType === 'raw' ? 'AÑADIR CARTA RAW' : selType === 'slab' ? 'AÑADIR SLAB PSA' : 'AÑADIR PRODUCTO SELLADO'}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '20px' }}>Busca la carta en el catálogo</div>

                <label style={lbl}>Buscar carta</label>
                <input style={inp} type="text" placeholder="Nombre de la carta..." value={searchQ}
                  onChange={e => { setSearchQ(e.target.value); setSelCard(null) }} autoFocus />
                {searching && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginTop: '6px' }}>Buscando...</div>}

                {searchRes.length > 0 && !selCard && (
                  <div style={{ maxHeight: '220px', overflowY: 'auto', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {searchRes.map(c => (
                      <div key={c.id} onClick={() => selectModalCard(c)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'border-color 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        {c.image && <img src={`${c.image}/low.png`} alt={c.name} style={{ width: '28px', height: '38px', objectFit: 'contain', borderRadius: '3px' }} onError={e => e.target.style.display = 'none'} />}
                        <div>
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '1px' }}>{c.name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>{c.set?.name || '—'} · #{c.localId}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selCard && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--accent-dim)', border: '1px solid rgba(212,245,60,0.2)', borderRadius: '6px', marginTop: '8px' }}>
                    {selCard.image && <img src={selCard.image} alt={selCard.name} style={{ width: '28px', height: '38px', objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent)' }}>{selCard.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>{selCard.set}</div>
                    </div>
                    <div style={{ color: 'var(--nm)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>✓ Seleccionada</div>
                    <button onClick={() => { setSelCard(null); setSearchQ('') }} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: '0.75rem', marginLeft: '4px' }}>✕</button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                  <button onClick={() => setModalOpen(false)} style={btnCancel}>Cancelar</button>
                  <button onClick={() => setModalStep(2)} disabled={!selCard}
                    style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: selCard ? 'pointer' : 'not-allowed', opacity: selCard ? 1 : 0.4, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Continuar →
                  </button>
                </div>
              </>
            )}

            {/* STEP 2 — Classify */}
            {modalStep === 2 && selCard && (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '1px', marginBottom: '14px' }}>
                  {selType === 'raw' ? 'CLASIFICAR CARTA RAW' : selType === 'slab' ? 'CLASIFICAR CARTA GRADED' : 'CLASIFICAR PRODUCTO SELLADO'}
                </div>

                {/* Card preview */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '8px', marginBottom: '18px' }}>
                  {selCard.image && <img src={selCard.image} alt={selCard.name} style={{ width: '40px', height: '55px', objectFit: 'contain', borderRadius: '4px', background: 'var(--surface2)', flexShrink: 0 }} onError={e => e.target.style.display = 'none'} />}
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '3px' }}>{selCard.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>{selCard.set}</div>
                  </div>
                </div>

                {/* Tipo */}
                <label style={lbl}>Tipo</label>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
                  {[{ v: 'raw', l: 'RAW' }, { v: 'slab', l: 'SLAB' }, { v: 'sealed', l: 'SELLADO' }].map(t => (
                    <button key={t.v} onClick={() => { setSelType(t.v); setSelCond(t.v === 'slab' ? 'PSA10' : 'NM') }}
                      style={{ flex: 1, padding: '8px', border: `1px solid ${selType === t.v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '6px', background: selType === t.v ? 'var(--accent-dim)' : 'none', color: selType === t.v ? 'var(--accent)' : 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.15s' }}>
                      {t.l}
                    </button>
                  ))}
                </div>

                {/* Condición RAW — descriptive options */}
                {selType === 'raw' && (
                  <>
                    <label style={lbl}>Estado de la carta</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                      {[
                        { v: 'NM', label: 'NM — Near Mint',          desc: 'Prácticamente perfecta, sin marcas visibles',  color: '#2ed573' },
                        { v: 'LP', label: 'LP — Lightly Played',      desc: 'Pequeñas marcas de uso, apenas visibles',      color: '#ffa502' },
                        { v: 'MP', label: 'MP — Moderately Played',   desc: 'Desgaste visible, dobleces o arañazos',        color: '#ff4757' },
                      ].map(opt => (
                        <div key={opt.v} onClick={() => setSelCond(opt.v)}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', background: 'var(--bg2)', border: `1px solid ${selCond === opt.v ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', transition: 'all 0.15s', background: selCond === opt.v ? 'var(--accent-dim)' : 'var(--bg2)' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '2px', color: 'var(--text)' }}>{opt.label}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>{opt.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Condición SLAB */}
                {selType === 'slab' && (
                  <>
                    <label style={lbl}>Grado PSA</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '6px', marginBottom: '14px' }}>
                      {condOpts.map(cv => (
                        <div key={cv} onClick={() => setSelCond(cv)}
                          style={{ padding: '8px', border: `1px solid ${selCond === cv ? (COND_COLOR[cv] || 'var(--accent)') : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', textAlign: 'center', background: selCond === cv ? (COND_BG[cv] || 'var(--accent-dim)') : 'var(--bg2)', transition: 'all 0.15s' }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, color: COND_COLOR[cv] || 'var(--text)' }}>{cv}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: '14px' }}>
                      <label style={lbl}>Número de certificado (opcional)</label>
                      <input style={inp} type="text" placeholder="Ej: 12345678" value={cert} onChange={e => setCert(e.target.value)} />
                    </div>
                  </>
                )}

                {/* Coste de compra */}
                <label style={lbl}>Coste de compra (€)</label>
                <div style={{ position: 'relative', marginBottom: '20px' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }}>€</span>
                  <input style={{ ...inp, paddingLeft: '24px' }} type="number" step="0.01" min="0" placeholder="0.00" value={paidPrice} onChange={e => setPaidPrice(e.target.value)} />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setModalStep(1)} style={btnCancel}>← Volver</button>
                  <button onClick={saveCard} disabled={saving}
                    style={{ flex: 2, padding: '10px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.5 : 1, textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.15s' }}>
                    {saving ? 'Guardando...' : 'Confirmar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes mIn { from { opacity:0; transform:scale(0.96) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }
      `}</style>
    </>
  )
}

// ---- Shared styles ----
const lbl = { fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '6px', display: 'block' }
const inp = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', letterSpacing: '0.3px' }
const btnCancel = { flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }

// ---- Sub-components ----
function Section({ title, icon, count, value, onAdd, addLabel = '+ Añadir', children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {icon && (
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: icon.bg, border: `1px solid ${icon.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>{icon.emoji}</div>
          )}
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '1px' }}>{title}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '1px' }}>{count}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {value && <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.5px', color: 'var(--accent)' }}>{value}</div>}
          <button onClick={onAdd}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 14px', border: '1px solid var(--border2)', borderRadius: '5px', background: 'none', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.3px', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text3)' }}
          >{addLabel}</button>
        </div>
      </div>
      {children}
    </div>
  )
}

function CardsGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '10px' }}>{children}</div>
}

function SealedGrid({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: '10px' }}>{children}</div>
}

function EmptyState({ title, sub, onClick }) {
  return (
    <div onClick={onClick}
      style={{ padding: '32px', textAlign: 'center', border: '1.5px dashed var(--border)', borderRadius: '10px', cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border2)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.5 }}>+</div>
      {title && <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px', color: 'var(--text2)', marginBottom: '4px' }}>{title}</div>}
      {sub && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', letterSpacing: '0.3px' }}>{sub}</div>}
    </div>
  )
}

function PortfolioCard({ c, mp }) {
  const isSlab = c.display_type === 'slab'
  const color  = COND_COLOR[c.condition] || 'var(--text2)'
  const bg     = COND_BG[c.condition]   || 'transparent'
  const cost   = c.paid_price ? parseFloat(c.paid_price) : null
  const pnl    = (mp !== null && cost !== null) ? (mp - cost) : null
  const priceEstimated = mp === null

  return (
    <div
      style={{ background: 'var(--surface)', border: `1px solid ${c.status === 'for_sale' ? 'rgba(212,245,60,0.2)' : 'var(--border)'}`, borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = c.status === 'for_sale' ? 'rgba(212,245,60,0.2)' : 'var(--border)'; e.currentTarget.style.boxShadow = '' }}
    >
      {c.status === 'for_sale' && (
        <span style={{ position: 'absolute', top: '7px', right: '7px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '1px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>EN VENTA</span>
      )}
      {(c.quantity || 1) > 1 && (
        <span style={{ position: 'absolute', top: '7px', left: '7px', background: '#08080d', color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', border: '1px solid rgba(212,245,60,0.35)', zIndex: 1 }}>x{c.quantity}</span>
      )}

      <div style={{ position: 'relative', width: '100%', height: '130px', background: isSlab ? 'linear-gradient(135deg,#1a1a0a,#2a2a10,#1a1a0a)' : 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: isSlab ? '2px solid rgba(212,245,60,0.15)' : 'none' }}>
        {c.card_image
          ? <img src={c.card_image} alt={c.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} onError={e => e.target.style.display = 'none'} />
          : <span style={{ fontSize: '2rem' }}>{isSlab ? '🏆' : '🃏'}</span>
        }
        <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: bg, border: `1px solid ${color}`, color, fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '3px', letterSpacing: '0.5px' }}>{c.condition}</span>
      </div>

      <div style={{ padding: '10px 11px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '1px' }}>{c.card_name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', marginBottom: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.card_set}{isSlab && c.cert ? ` · #${c.cert}` : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          {cost !== null && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.57rem', color: 'var(--text2)' }}>Coste €{cost.toFixed(2)}</div>}
          {mp !== null
            ? <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.5px', color: 'var(--accent)' }}>€{mp.toFixed(2)}</div>
            : cost !== null && <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.5px', color: 'var(--text3)' }}>€{cost.toFixed(2)}</div>
          }
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

function SealedCard({ c, mp }) {
  const cost  = c.paid_price ? parseFloat(c.paid_price) : null
  const val   = mp ?? cost ?? 0
  const pnl   = (mp !== null && cost !== null) ? (mp - cost) : null

  return (
    <div
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '' }}
    >
      <div style={{ width: '100%', height: '150px', background: 'linear-gradient(135deg,#1a1208,#2a200a,#1a1208)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {c.card_image
          ? <img src={c.card_image} alt={c.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '8px' }} onError={e => e.target.style.display = 'none'} />
          : <span style={{ fontSize: '3rem' }}>📦</span>
        }
      </div>
      <div style={{ padding: '11px 12px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: '#f59e0b', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '3px', padding: '2px 7px' }}>📦 SELLADO</span>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', letterSpacing: '0.5px', marginBottom: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.card_name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', marginBottom: '7px', letterSpacing: '0.3px' }}>{c.card_set}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.5px', color: '#f59e0b' }}>€{val.toFixed(2)}</div>
          {pnl !== null && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: pnl >= 0 ? '#2ed573' : '#ff4757' }}>{pnl >= 0 ? '+' : ''}€{pnl.toFixed(2)}</div>}
        </div>
        {cost !== null && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', marginTop: '3px' }}>Coste: €{cost.toFixed(2)}</div>}
      </div>
    </div>
  )
}

function ListingCard({ l, onClick }) {
  const color = COND_COLOR[l.condition] || 'var(--text2)'
  const bg    = COND_BG[l.condition]   || 'transparent'
  return (
    <div onClick={onClick}
      style={{ background: 'var(--surface)', border: '1px solid rgba(212,245,60,0.15)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      <span style={{ position: 'absolute', top: '7px', right: '7px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.55rem', fontWeight: 700, letterSpacing: '1px', padding: '2px 6px', borderRadius: '3px', zIndex: 1 }}>EN VENTA</span>
      <div style={{ width: '100%', height: '130px', background: 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {l.card_image
          ? <img src={l.card_image} alt={l.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} onError={e => e.target.style.display = 'none'} />
          : <span style={{ fontSize: '2rem' }}>🎴</span>
        }
        {l.condition && (
          <span style={{ position: 'absolute', bottom: '6px', left: '6px', background: bg, border: `1px solid ${color}`, color, fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '3px', letterSpacing: '0.5px' }}>{l.condition}</span>
        )}
      </div>
      <div style={{ padding: '9px 11px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '1px' }}>{l.card_name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', marginBottom: '6px' }}>{l.card_set}</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.5px', color: 'var(--accent)' }}>€{parseFloat(l.price).toFixed(2)}</div>
      </div>
    </div>
  )
}
