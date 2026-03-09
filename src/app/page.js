'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const BASE = 'https://api.tcgdex.net/v2/en'
const PER_PAGE = 20

// ─── helpers ───────────────────────────────────────────────────────────────

function fmtPrice(v) {
  if (!v || isNaN(v)) return null
  return `€${parseFloat(v).toFixed(2)}`
}
function getPrimaryPrice(pricing) {
  if (!pricing?.cardmarket) return null
  return pricing.cardmarket.trend || pricing.cardmarket.avg || pricing.cardmarket.low || null
}
function getChangePercent(pricing) {
  if (!pricing?.cardmarket) return null
  const { avg1, avg7 } = pricing.cardmarket
  if (avg1 && avg7 && avg7 !== 0) return ((avg1 - avg7) / avg7) * 100
  return null
}

function buildChartSvg(cm, period) {
  const W = 500, H = 100, pad = 10
  if (!cm) return `<text x="250" y="52" text-anchor="middle" fill="var(--text3)" font-size="11" font-family="DM Mono">Sin datos</text>`
  let pts = []
  if (period === '1d') {
    const base = cm.avg1 || cm.trend || cm.avg
    if (!base) return noData()
    for (let i = 23; i >= 0; i--) pts.push(i === 0 ? base : base * (0.98 + Math.random() * 0.04))
    pts.reverse(); pts[pts.length - 1] = cm.avg1 || base
  } else if (period === '7d') {
    const today = cm.avg1 || cm.trend, avg7 = cm.avg7 || today
    if (!today) return noData()
    const start = avg7 * 0.94
    for (let i = 0; i < 7; i++) {
      const t = i / 6
      pts.push(Math.max(start + (today - start) * t + (Math.random() - 0.5) * avg7 * 0.04, 0.01))
    }
    pts[pts.length - 1] = today
  } else {
    const today = cm.avg1 || cm.trend, avg7 = cm.avg7 || today, avg30 = cm.avg30 || avg7
    if (!today) return noData()
    for (let i = 0; i < 30; i++) {
      const t = i / 29
      const mid = avg30 + (today - avg30) * t
      pts.push(Math.max(mid + (Math.random() - 0.5) * avg30 * 0.06, 0.01))
    }
    pts[pts.length - 1] = today
  }
  if (!pts.length) return noData()
  const mn = Math.min(...pts), mx = Math.max(...pts), range = mx - mn || mn * 0.1 || 0.01
  const x = i => pad + (i / (pts.length - 1)) * (W - pad * 2)
  const y = v => H - pad - ((v - mn) / range) * (H - pad * 2)
  const trend = pts[pts.length - 1] - pts[0]
  const col = trend >= 0 ? 'var(--nm)' : 'var(--mp)'
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const area = line + ` L${x(pts.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="${col}" stop-opacity="0.18"/>
    <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
  </linearGradient></defs>
  <path d="${area}" fill="url(#g)"/>
  <path d="${line}" stroke="${col}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(pts[pts.length - 1]).toFixed(1)}" r="4" fill="${col}" stroke="var(--bg2)" stroke-width="2"/>`
}
function noData() {
  return `<text x="250" y="52" text-anchor="middle" fill="var(--text3)" font-size="11" font-family="DM Mono">Sin datos</text>`
}

function chartDatapoints(cm, period) {
  if (!cm) return []
  if (period === '1d') {
    return [
      cm.avg1 && { l: 'Ahora', v: `€${parseFloat(cm.avg1).toFixed(2)}`, c: 'var(--nm)' },
      cm.low && { l: 'Mínimo', v: `€${parseFloat(cm.low).toFixed(2)}`, c: 'var(--text3)' },
      cm.trend && { l: 'Tendencia', v: `€${parseFloat(cm.trend).toFixed(2)}`, c: 'var(--accent)' },
    ].filter(Boolean)
  }
  if (period === '7d') {
    return [
      cm.avg1 && { l: 'Hoy', v: `€${parseFloat(cm.avg1).toFixed(2)}`, c: 'var(--nm)' },
      cm.avg7 && { l: 'Media 7D', v: `€${parseFloat(cm.avg7).toFixed(2)}`, c: 'var(--text3)' },
      cm.trend && { l: 'Tendencia', v: `€${parseFloat(cm.trend).toFixed(2)}`, c: 'var(--accent)' },
    ].filter(Boolean)
  }
  return [
    cm.avg1 && { l: 'Hoy', v: `€${parseFloat(cm.avg1).toFixed(2)}`, c: 'var(--nm)' },
    cm.avg30 && { l: 'Media 30D', v: `€${parseFloat(cm.avg30).toFixed(2)}`, c: 'var(--text3)' },
    cm.low && { l: 'Mínimo', v: `€${parseFloat(cm.low).toFixed(2)}`, c: 'var(--accent)' },
  ].filter(Boolean)
}

const COND_LABEL = { NM: 'Near Mint', LP: 'Lightly Played', MP: 'Mod. Played', PSA10: 'PSA 10', PSA9: 'PSA 9', PSA8: 'PSA 8' }

// ─── component ─────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter()
  const sbRef = useRef(null)
  const cardCacheRef = useRef({})

  // Sets / cards
  const [allSets, setAllSets] = useState([])
  const [curCards, setCurCards] = useState([])
  const [activeSetId, setActiveSetId] = useState(null)
  const [cardListingsMap, setCardListingsMap] = useState({})

  // UI
  const [status, setStatus] = useState({ type: 's-loading', msg: 'Conectando...' })
  const [cardsTitle, setCardsTitle] = useState('CARTAS')
  const [cardsSub, setCardsSub] = useState('—')
  const [displayMode, setDisplayModeState] = useState('raw')
  const [condFilter, setCondFilter] = useState('all')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [curPage, setCurPage] = useState(1)

  // KPIs / hero
  const [hCards, setHCards] = useState('—')
  const [hSets, setHSets] = useState('—')
  const [heroName, setHeroName] = useState('Cargando...')
  const [heroSetText, setHeroSetText] = useState('—')
  const [heroPrice, setHeroPrice] = useState('€—')
  const [heroChg, setHeroChg] = useState(null)
  const [heroImgUrl, setHeroImgUrl] = useState(null)

  // Card modal
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCard, setModalCard] = useState(null)      // full card data
  const [modalPricing, setModalPricing] = useState(null)
  const [chartPeriod, setChartPeriod] = useState('7d')
  const [modalListings, setModalListings] = useState([])
  const [modalBuyOffers, setModalBuyOffers] = useState([])
  const [sellerTab, setSellerTab] = useState('raw')
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [sellersLoading, setSellersLoading] = useState(false)
  const [offersLoading, setOffersLoading] = useState(false)

  // Buy modal
  const [buyListing, setBuyListing] = useState(null)
  const [verif, setVerif] = useState('none')

  // Offer modal
  const [offerOpen, setOfferOpen] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [offerCond, setOfferCond] = useState('NM')
  const [offerMsg, setOfferMsg] = useState(null)
  const [offerLoading, setOfferLoading] = useState(false)

  // Auth
  const [user, setUser] = useState(null)

  // ── init supabase & auth ──────────────────────────────────────────────────

  useEffect(() => {
    sbRef.current = createClient()
    sbRef.current.auth.getUser().then(({ data: { user } }) => setUser(user ?? null))
    const { data: { subscription } } = sbRef.current.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── fetch sets on mount ───────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const r = await fetch(`${BASE}/sets`)
        if (!r.ok) throw new Error(r.status)
        const data = await r.json()
        const sets = [...data].reverse()
        setAllSets(sets)
        setHSets(sets.length + '+')
        setStatus({ type: 's-ok', msg: `✅ ${sets.length} colecciones` })
        if (sets[0]) loadSet(sets[0])
      } catch {
        setStatus({ type: 's-err', msg: '⚠ Sin conexión' })
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── load set ─────────────────────────────────────────────────────────────

  async function loadSet(set) {
    setActiveSetId(set.id)
    setCurPage(1)
    setCardsTitle(set.name.toUpperCase())
    setCardsSub('Cargando...')
    // shimmer — clear cards while loading
    setCurCards([])
    setCardListingsMap({})
    try {
      const r = await fetch(`${BASE}/sets/${set.id}`)
      const data = await r.json()
      const rawCards = data.cards || []
      setHCards(rawCards.length + '+')
      setCardsSub(`0 / ${rawCards.length}`)
      setStatus({ type: 's-loading', msg: 'Precios...' })

      const BATCH = 10
      let loaded = 0
      for (let i = 0; i < rawCards.length; i += BATCH) {
        const batch = rawCards.slice(i, i + BATCH)
        await Promise.all(batch.map(async card => {
          if (!cardCacheRef.current[card.id]) {
            try {
              const cr = await fetch(`${BASE}/cards/${card.id}`)
              cardCacheRef.current[card.id] = await cr.json()
            } catch {
              cardCacheRef.current[card.id] = { ...card, pricing: null }
            }
          }
          loaded++
          setCardsSub(`${loaded} / ${rawCards.length}`)
        }))
      }

      const sorted = [...rawCards].sort((a, b) => {
        const pa = parseFloat(getPrimaryPrice(cardCacheRef.current[a.id]?.pricing)) || 0
        const pb = parseFloat(getPrimaryPrice(cardCacheRef.current[b.id]?.pricing)) || 0
        return pb - pa
      })

      setCardsSub(`${sorted.length} cartas · precio desc.`)
      setStatus({ type: 's-ok', msg: `✅ ${allSets.length || sorted.length} colecciones` })
      setCurCards(sorted)

      // preload listings for condition badges
      if (sorted.length && sbRef.current) {
        try {
          const { data: setListings } = await sbRef.current
            .from('listings')
            .select('card_id, condition, display_type')
            .in('card_id', sorted.map(c => c.id))
            .eq('sold', false)
          const map = {}
          if (setListings) {
            setListings.forEach(l => {
              if (!map[l.card_id]) map[l.card_id] = { conds: [], grades: [] }
              if (l.display_type === 'raw' && l.condition) map[l.card_id].conds.push(l.condition)
              if (l.display_type === 'slab' && l.condition) map[l.card_id].grades.push(l.condition)
            })
          }
          setCardListingsMap(map)
        } catch (e) { console.warn('[loadSet] listings:', e.message) }
      }

      // hero
      if (sorted[0]) fetchAndUpdateHero(sorted[0], set)
    } catch {
      setCardsSub('Error')
      setStatus({ type: 's-err', msg: '⚠ Error' })
    }
  }

  async function fetchAndUpdateHero(card, set) {
    try {
      const data = cardCacheRef.current[card.id] || await fetch(`${BASE}/cards/${card.id}`).then(r => r.json())
      const price = getPrimaryPrice(data.pricing)
      const change = getChangePercent(data.pricing)
      setHeroImgUrl(data.image ? data.image + '/low.png' : null)
      setHeroName(data.name)
      setHeroSetText(`${set.name.toUpperCase()} · #${data.localId}`)
      setHeroPrice(price ? `€${parseFloat(price).toFixed(2)}` : '—')
      if (change !== null) {
        setHeroChg({ dir: change >= 0 ? '▲' : '▼', val: Math.abs(change).toFixed(1), pos: change >= 0 })
      }
    } catch { /* ignore */ }
  }

  // ── derived: filtered cards ───────────────────────────────────────────────

  function getSlabGrade(id) {
    const grades = cardListingsMap[id]?.grades || []
    if (grades.includes('PSA10')) return 'PSA10'
    if (grades.includes('PSA9')) return 'PSA9'
    if (grades.includes('PSA8')) return 'PSA8'
    return null
  }
  function getCardCond(id) {
    const conds = cardListingsMap[id]?.conds || []
    if (conds.includes('NM')) return 'NM'
    if (conds.includes('LP')) return 'LP'
    if (conds.includes('MP')) return 'MP'
    return null
  }

  const q = search.toLowerCase()
  const isSlab = displayMode === 'slab'

  const filtered = curCards.filter(card => {
    if (q && !card.name.toLowerCase().includes(q)) return false
    const cardCondVal = getCardCond(card.id)
    if (!isSlab && condFilter !== 'all' && cardCondVal && cardCondVal !== condFilter) return false
    const slabGradeVal = getSlabGrade(card.id)
    if (isSlab && gradeFilter !== 'all' && slabGradeVal && slabGradeVal !== gradeFilter) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const pageSlice = filtered.slice((curPage - 1) * PER_PAGE, curPage * PER_PAGE)

  // ── display mode / filters ────────────────────────────────────────────────

  function switchDisplay(mode) {
    setDisplayModeState(mode)
    setCondFilter('all')
    setGradeFilter('all')
    setCurPage(1)
  }

  function handleSetCond(c) {
    setCondFilter(c)
    setCurPage(1)
  }

  function handleSetGrade(g) {
    setGradeFilter(g)
    setCurPage(1)
  }

  // ── open card modal ───────────────────────────────────────────────────────

  async function openCard(id, name) {
    setModalCard({ id, name, set: null, image: null, pricing: null, rarity: null, localId: null })
    setModalPricing(null)
    setChartPeriod('7d')
    setSellerTab('raw')
    setCollapsedGroups({})
    setModalListings([])
    setModalBuyOffers([])
    setModalOpen(true)

    try {
      if (!cardCacheRef.current[id]) {
        const r = await fetch(`${BASE}/cards/${id}`)
        cardCacheRef.current[id] = await r.json()
      }
      const card = cardCacheRef.current[id]
      setModalCard(card)
      setModalPricing(card.pricing?.cardmarket || null)
      fetchSellers(id, getPrimaryPrice(card.pricing))
      fetchBuyOffers(id)
    } catch {
      setModalCard(prev => ({ ...prev, name: 'Error al cargar' }))
    }
  }

  async function fetchSellers(cardId, basePrice) {
    setSellersLoading(true)
    const { data: listings } = await sbRef.current
      .from('listings')
      .select('id, price, condition, display_type, seller_id')
      .eq('card_id', cardId)
      .eq('sold', false)
      .order('price', { ascending: true })
    setModalListings(listings || [])
    setSellersLoading(false)
  }

  async function fetchBuyOffers(cardId) {
    setOffersLoading(true)
    const { data: offers } = await sbRef.current
      .from('buy_offers')
      .select('id, price, condition, user_id, created_at')
      .eq('card_id', cardId)
      .eq('status', 'open')
      .order('price', { ascending: false })
      .limit(6)
    setModalBuyOffers(offers || [])
    setOffersLoading(false)
  }

  function toggleGroup(key) {
    setCollapsedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── buy now ───────────────────────────────────────────────────────────────

  function goToCheckout(listingId) {
    router.push(`/checkout/${listingId}`)
  }

  function openBuyModal(listing) {
    setBuyListing(listing)
    setVerif('none')
  }

  async function confirmBuy() {
    if (!user) { alert('Debes iniciar sesión para comprar.'); return }
    if (!buyListing) return
    const base = parseFloat(buyListing.price)
    const verifRate = verif === 'ai' ? 0.02 : verif === 'human' ? 0.05 : 0
    const total = base + base * verifRate
    const { error } = await sbRef.current.from('orders').insert({
      listing_id: buyListing.id,
      buyer_id: user.id,
      seller_id: buyListing.seller_id,
      card_id: modalCard?.id,
      price: total,
      verification_type: verif,
      status: 'pending',
    })
    if (error) { alert('Error al procesar la compra: ' + error.message); return }
    setBuyListing(null)
    alert(`Compra registrada por €${total.toFixed(2)}. El vendedor recibirá una notificación.`)
  }

  // ── make offer ────────────────────────────────────────────────────────────

  function openMakeOffer() {
    if (!modalCard?.id) return
    setOfferPrice('')
    setOfferCond('NM')
    setOfferMsg(null)
    setOfferOpen(true)
  }

  async function submitMakeOffer() {
    if (!user) { alert('Debes iniciar sesión para hacer una oferta.'); return }
    const price = parseFloat(offerPrice)
    if (!price || price <= 0) { setOfferMsg({ text: 'Introduce un precio válido.', ok: false }); return }
    setOfferLoading(true)
    const { error } = await sbRef.current.from('buy_offers').insert({
      card_id: modalCard.id,
      user_id: user.id,
      price,
      condition: offerCond,
      status: 'open',
    })
    setOfferLoading(false)
    if (error) { setOfferMsg({ text: 'Error: ' + error.message, ok: false }); return }
    setOfferOpen(false)
    fetchBuyOffers(modalCard.id)
  }

  // ── accept offer ──────────────────────────────────────────────────────────

  async function acceptOffer(offerId, buyerUserId, price) {
    if (!user) { alert('Debes iniciar sesión.'); return }
    if (!confirm(`¿Aceptar oferta de €${parseFloat(price).toFixed(2)}?`)) return
    const { error: e1 } = await sbRef.current.from('buy_offers').update({ status: 'accepted' }).eq('id', offerId)
    if (e1) { alert('Error: ' + e1.message); return }
    const { error: e2 } = await sbRef.current.from('orders').insert({
      buyer_id: buyerUserId,
      seller_id: user.id,
      card_id: modalCard?.id,
      price,
      verification_type: 'none',
      status: 'pending',
      source: 'buy_offer',
      offer_id: offerId,
    })
    if (e2) { alert('Error al crear orden: ' + e2.message); return }
    alert('Oferta aceptada. Orden creada.')
    fetchBuyOffers(modalCard.id)
  }

  // ── buy modal breakdown ───────────────────────────────────────────────────

  const buyBase = buyListing ? parseFloat(buyListing.price) : 0
  const verifRate = verif === 'ai' ? 0.02 : verif === 'human' ? 0.05 : 0
  const verifCost = buyBase * verifRate
  const buyTotal = buyBase + verifCost

  // ── sellers render helpers ────────────────────────────────────────────────

  const filteredListings = modalListings.filter(l =>
    sellerTab === 'raw' ? l.display_type === 'raw' : l.display_type === 'slab'
  )
  const sellerGroups = sellerTab === 'raw' ? ['NM', 'LP', 'MP'] : ['PSA10', 'PSA9', 'PSA8']
  const basePrice = modalCard ? getPrimaryPrice(modalCard.pricing) : null

  // ── shimmer cards ─────────────────────────────────────────────────────────

  const shimmerCards = Array(8).fill(0).map((_, i) => (
    <div key={i} className="card-item">
      <div className="card-img shimmer" style={{ height: 145 }} />
      <div className="card-body">
        <div className="shimmer" style={{ height: 14, marginBottom: 6 }} />
        <div className="shimmer" style={{ height: 10, width: '55%' }} />
      </div>
    </div>
  ))

  const shimmerCols = Array(5).fill(0).map((_, i) => (
    <div key={i} className="col-item shimmer" style={{ height: 46, marginBottom: 2 }} />
  ))

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* TICKER */}
      <div className="ticker-wrap">
        <div className="ticker-label">LIVE</div>
        <div className="ticker-scroll">
          {/* Ticker static placeholder — could be populated from real data later */}
          {[
            { n: 'Charizard ex', p: '€148.50', c: '+3.2%', up: true },
            { n: 'Pikachu VMAX', p: '€62.00', c: '+1.1%', up: true },
            { n: 'Mewtwo ex', p: '€95.30', c: '-0.8%', up: false },
            { n: 'Umbreon VMAX', p: '€78.20', c: '+5.4%', up: true },
            { n: 'Rayquaza ex', p: '€55.00', c: '-1.2%', up: false },
          ].concat([
            { n: 'Charizard ex', p: '€148.50', c: '+3.2%', up: true },
            { n: 'Pikachu VMAX', p: '€62.00', c: '+1.1%', up: true },
            { n: 'Mewtwo ex', p: '€95.30', c: '-0.8%', up: false },
            { n: 'Umbreon VMAX', p: '€78.20', c: '+5.4%', up: true },
            { n: 'Rayquaza ex', p: '€55.00', c: '-1.2%', up: false },
          ]).map((d, i) => (
            <div key={i} className="ticker-item">
              <span className="ticker-name">{d.n}</span>
              <span className="ticker-price">{d.p}</span>
              <span className={d.up ? 'ticker-up' : 'ticker-down'}>{d.c}</span>
            </div>
          ))}
        </div>
      </div>

      {/* HERO */}
      <div className="hero">
        <div className="hero-left">
          <div>
            <div className="hero-eyebrow">
              <span className="eyebrow-tag">Pokémon TCG</span>
              <span className="eyebrow-tag2">PRECIOS CARDMARKET · EUR</span>
            </div>
            <div className="hero-headline">
              TRADE<br />
              <span className="line2">SMARTER.</span>
            </div>
            <p className="hero-desc">
              El marketplace definitivo para cartas Pokémon. Precios en tiempo real, verificación de autenticidad y envío integrado. La nueva infraestructura del mercado TCG.
            </p>
          </div>
          <div className="hero-kpis">
            <div className="kpi">
              <div className="kpi-val">{hCards}</div>
              <div className="kpi-label">Cartas</div>
            </div>
            <div className="kpi">
              <div className="kpi-val">{hSets}</div>
              <div className="kpi-label">Sets</div>
            </div>
            <div className="kpi">
              <div className="kpi-val">5-8%</div>
              <div className="kpi-label">Comisión</div>
            </div>
            <div className="kpi">
              <div className="kpi-val">EUR</div>
              <div className="kpi-label">Divisa</div>
            </div>
          </div>
        </div>
        <div className="hero-right">
          <div className="featured-card">
            <div className="fc-img">
              {heroImgUrl
                ? <img src={heroImgUrl} alt={heroName} onError={e => { e.target.parentNode.innerHTML = '⚡' }} />
                : '⚡'}
            </div>
            <div className="fc-body">
              <div className="fc-name">{heroName}</div>
              <div className="fc-set">{heroSetText}</div>
              <div className="fc-price-row">
                <div className="fc-price">{heroPrice}</div>
                {heroChg && (
                  <div className="fc-chg" style={{ color: heroChg.pos ? 'var(--nm)' : 'var(--mp)' }}>
                    {heroChg.dir} {heroChg.val}%
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LAYOUT */}
      <div className="layout">

        {/* SIDEBAR */}
        <div className="sidebar">
          <div className={`status-pill ${status.type}`}>
            {status.type === 's-loading' && <span className="spin">⟳</span>}
            {' '}{status.msg}
          </div>
          <div className="sidebar-section">
            <div className="sidebar-title">Colecciones</div>
            <div>
              {allSets.length === 0
                ? shimmerCols
                : allSets.slice(0, 15).map(s => (
                  <div
                    key={s.id}
                    className={`col-item${activeSetId === s.id ? ' active' : ''}`}
                    onClick={() => loadSet(s)}
                  >
                    <img
                      className="ci-logo"
                      src={`https://assets.tcgdex.net/univ/${s.serie?.id || 'sv'}/${s.id}/logo.png`}
                      onError={e => { e.target.style.display = 'none' }}
                      alt=""
                    />
                    <div className="ci-info">
                      <div className="ci-name">{s.name}</div>
                      <div className="ci-count">{s.cardCount?.total || '—'} cartas</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="content">
          {/* TOOLBAR */}
          <div className="toolbar">
            <div className="toolbar-title">{cardsTitle}</div>
            <div className="toolbar-count">{cardsSub}</div>
            <div className="sep" />
            <button
              className={`cond-btn${displayMode === 'raw' ? ' disp-active' : ''}`}
              onClick={() => switchDisplay('raw')}
            >RAW</button>
            <button
              className={`cond-btn${displayMode === 'slab' ? ' disp-active' : ''}`}
              onClick={() => switchDisplay('slab')}
            >SLAB</button>
            <div className="sep" />

            {/* RAW filters */}
            {displayMode === 'raw' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {['all', 'NM', 'LP', 'MP'].map(c => (
                  <button
                    key={c}
                    className={`cond-btn${condFilter === c ? (c === 'all' ? ' c-all' : c === 'NM' ? ' c-nm' : c === 'LP' ? ' c-lp' : ' c-mp') : ''}`}
                    onClick={() => handleSetCond(c)}
                  >{c === 'all' ? 'TODOS' : c}</button>
                ))}
              </div>
            )}

            {/* SLAB filters */}
            {displayMode === 'slab' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  className={`cond-btn${gradeFilter === 'all' ? ' c-all' : ''}`}
                  style={{ borderColor: 'var(--border2)', color: 'var(--text2)', background: 'var(--surface2)' }}
                  onClick={() => handleSetGrade('all')}
                >TODOS</button>
                {['PSA10', 'PSA9', 'PSA8'].map(g => (
                  <button
                    key={g}
                    className={`cond-btn ${g.toLowerCase().replace('psa', 'psa')}${gradeFilter === g ? ' grade-active' : ''}`}
                    style={
                      g === 'PSA10' ? { borderColor: '#d4f53c', color: '#d4f53c', background: gradeFilter === g ? 'rgba(212,245,60,0.18)' : 'rgba(212,245,60,0.07)' }
                      : g === 'PSA9' ? { borderColor: '#38bdf8', color: '#38bdf8', background: gradeFilter === g ? 'rgba(56,189,248,0.18)' : 'rgba(56,189,248,0.07)' }
                      : { borderColor: '#a78bfa', color: '#a78bfa', background: gradeFilter === g ? 'rgba(167,139,250,0.18)' : 'rgba(167,139,250,0.07)' }
                    }
                    onClick={() => handleSetGrade(g)}
                  >{g.replace('PSA', 'PSA ')}</button>
                ))}
              </div>
            )}

            <div className="search-wrap">
              <span className="search-icon">⌕</span>
              <input
                type="text"
                placeholder="Buscar carta..."
                value={search}
                onChange={e => { setSearch(e.target.value); setCurPage(1) }}
              />
            </div>
          </div>

          {/* CARDS */}
          <div className="cards-area">
            <div className="cards-grid">
              {curCards.length === 0 && status.type !== 's-err'
                ? shimmerCards
                : pageSlice.length === 0
                  ? <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text3)', padding: 40, fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                    {status.type === 's-err' ? 'No se pudo conectar con la API' : 'Sin resultados'}
                  </div>
                  : pageSlice.map((card, i) => {
                    const rank = (curPage - 1) * PER_PAGE + i + 1
                    const cached = cardCacheRef.current[card.id]
                    const bp = getPrimaryPrice(cached?.pricing)
                    const change = getChangePercent(cached?.pricing)
                    const cm = cached?.pricing?.cardmarket
                    const url = card.image ? card.image + '/low.png' : null
                    const cardCond = getCardCond(card.id)
                    const slabGrade = getSlabGrade(card.id)

                    return (
                      <div
                        key={card.id}
                        className={`card-item${isSlab ? ' is-slab' : ''}`}
                        onClick={() => openCard(card.id, card.name)}
                      >
                        <div className="card-img">
                          {url
                            ? <img src={url} alt={card.name} loading="lazy" onError={e => { e.target.parentNode.innerHTML = '🎴' }} />
                            : '🎴'}
                          {/* badge */}
                          {isSlab && slabGrade && (
                            <div className={`slab-badge ${slabGrade === 'PSA10' ? 'slab-10' : slabGrade === 'PSA9' ? 'slab-9' : 'slab-8'}`}>
                              🏆 {slabGrade.replace('PSA', 'PSA ')}
                            </div>
                          )}
                          {!isSlab && cardCond && (
                            <div className={`raw-badge ${cardCond === 'NM' ? 'raw-nm' : cardCond === 'LP' ? 'raw-lp' : 'raw-mp'}`}>
                              {cardCond}
                            </div>
                          )}
                          <div className="card-rank">#{rank}</div>
                        </div>
                        <div className="card-body">
                          <div className="card-name">{card.name}</div>
                          <div className="card-num">{card.localId}</div>
                          <div className="card-footer">
                            {bp
                              ? <div className="card-price">€{parseFloat(bp).toFixed(2)}</div>
                              : <div className="card-price no-data">SIN PRECIO</div>}
                            {change !== null
                              ? <div className={`card-chg ${change >= 0 ? 'chg-up' : 'chg-down'}`}>
                                {change >= 0 ? '▲' : '▼'}{Math.abs(change).toFixed(1)}%
                              </div>
                              : <div className="card-chg" />}
                          </div>
                          {/* price strip */}
                          {cm?.trend && !isSlab && (
                            <div className="price-strip">
                              <div className="psi"><div className="psi-label">NM</div><div className="psi-val" style={{ color: 'var(--nm)' }}>€{parseFloat(cm.trend).toFixed(2)}</div></div>
                              <div className="psi"><div className="psi-label">LP</div><div className="psi-val" style={{ color: 'var(--lp)' }}>€{(cm.trend * 0.75).toFixed(2)}</div></div>
                              <div className="psi"><div className="psi-label">MP</div><div className="psi-val" style={{ color: 'var(--mp)' }}>€{(cm.trend * 0.48).toFixed(2)}</div></div>
                            </div>
                          )}
                          {cm?.trend && isSlab && (
                            <div className="price-strip">
                              <div className="psi"><div className="psi-label">PSA 10</div><div className="psi-val" style={{ color: '#d4f53c' }}>€{(cm.trend * 4.5).toFixed(2)}</div></div>
                              <div className="psi"><div className="psi-label">PSA 9</div><div className="psi-val" style={{ color: '#38bdf8' }}>€{(cm.trend * 2.2).toFixed(2)}</div></div>
                              <div className="psi"><div className="psi-label">PSA 8</div><div className="psi-val" style={{ color: '#a78bfa' }}>€{(cm.trend * 1.4).toFixed(2)}</div></div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
            </div>

            {/* PAGINATION */}
            {totalPages > 1 && (
              <div className="pagination">
                <button className="page-btn" disabled={curPage === 1} onClick={() => setCurPage(p => p - 1)}>←</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => {
                  if (p === 1 || p === totalPages || Math.abs(p - curPage) <= 2) {
                    return <button key={p} className={`page-btn${p === curPage ? ' active' : ''}`} onClick={() => setCurPage(p)}>{p}</button>
                  }
                  if (Math.abs(p - curPage) === 3) {
                    return <span key={p} style={{ color: 'var(--text3)', padding: '0 4px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>…</span>
                  }
                  return null
                })}
                <button className="page-btn" disabled={curPage === totalPages} onClick={() => setCurPage(p => p + 1)}>→</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── CARD MODAL ───────────────────────────────────────────────────── */}
      <div className={`modal-overlay${modalOpen ? ' open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
        <div className="modal">
          {/* LEFT */}
          <div className="modal-left">
            <div className="m-card-img">
              {modalCard?.image
                ? <img src={modalCard.image + '/high.png'} alt={modalCard.name} onError={e => { e.target.parentNode.innerHTML = '🎴' }} />
                : '🎴'}
            </div>
            <div>
              <div className="m-card-name">{modalCard?.name || '—'}</div>
              <div className="m-card-set">
                {modalCard?.set?.name || ''}{modalCard?.localId ? ` · #${modalCard.localId}` : ''}{modalCard?.rarity ? ` · ${modalCard.rarity}` : ''}
              </div>
            </div>
            <div className="cond-strip">
              <span className="badge badge-nm">NM</span>
              <span className="badge badge-lp">LP</span>
              <span className="badge badge-mp">MP</span>
            </div>
            <div className="price-box">
              <div className="price-box-title">Cardmarket · EUR</div>
              {[
                ['Tendencia', fmtPrice(modalPricing?.trend)],
                ['Mínimo', fmtPrice(modalPricing?.low)],
                ['Media 1D', fmtPrice(modalPricing?.avg1)],
                ['Media 7D', fmtPrice(modalPricing?.avg7)],
                ['Media 30D', fmtPrice(modalPricing?.avg30)],
              ].map(([label, val]) => (
                <div key={label} className="pb-row">
                  <span className="pb-label">{label}</span>
                  <span className="pb-val">{val || '—'}</span>
                </div>
              ))}
              <div className="cm-badge">✓ FUENTE: CARDMARKET</div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="modal-right">
            <div className="m-header">
              <div>
                <div className="m-price-label">PRECIO DE MERCADO</div>
                {(() => {
                  const price = modalCard ? getPrimaryPrice(modalCard.pricing) : null
                  const change = modalCard ? getChangePercent(modalCard.pricing) : null
                  return (
                    <>
                      <div className={`m-price${!price ? ' no-data' : ''}`}>
                        {price ? `€${parseFloat(price).toFixed(2)}` : 'Sin precio'}
                      </div>
                      {price && change !== null && (
                        <div className="m-chg" style={{ color: change >= 0 ? 'var(--nm)' : 'var(--mp)' }}>
                          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}% (7D) · Cardmarket
                        </div>
                      )}
                      {price && change === null && (
                        <div className="m-chg" style={{ color: 'var(--text3)' }}>Sin variación reciente</div>
                      )}
                    </>
                  )
                })()}
              </div>
              <button className="m-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>

            {!getPrimaryPrice(modalCard?.pricing) && (
              <div className="no-price-notice">⚠ Esta carta no tiene datos de precio en Cardmarket aún.</div>
            )}

            {/* CHART */}
            <div className="chart-wrap">
              <div className="chart-head">
                <div className="chart-label">Historial de precio</div>
                <div className="chart-period-btns">
                  {['1d', '7d', '30d'].map(p => (
                    <button
                      key={p}
                      className={`cp-btn${chartPeriod === p ? ' active' : ''}`}
                      onClick={() => setChartPeriod(p)}
                    >{p.toUpperCase()}</button>
                  ))}
                </div>
              </div>
              <svg
                className="chart"
                viewBox="0 0 500 100"
                dangerouslySetInnerHTML={{ __html: buildChartSvg(modalPricing, chartPeriod) }}
              />
              <div className="chart-datapoints">
                {chartDatapoints(modalPricing, chartPeriod).map(dp => (
                  <div key={dp.l} className="cdp">
                    <div className="cdp-label">{dp.l}</div>
                    <div className="cdp-val" style={{ color: dp.c }}>{dp.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* SELLERS */}
            <div className="sellers-hd">
              VENDEDORES {modalListings.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400, letterSpacing: 0 }}>({modalListings.length})</span>}
            </div>
            <div className="sellers-type-tabs">
              {['raw', 'graded'].map((t, i) => (
                <button key={t} className={`stt-btn${sellerTab === t ? ' active' : ''}`} onClick={() => setSellerTab(t)}>
                  {t === 'raw' ? 'RAW' : 'GRADED'}
                </button>
              ))}
            </div>
            <div>
              {sellersLoading
                ? <div style={{ color: 'var(--text3)', fontSize: '0.75rem', padding: 10, fontFamily: 'var(--font-mono)' }}>Buscando vendedores...</div>
                : filteredListings.length === 0
                  ? <div style={{ color: 'var(--text3)', fontSize: '0.75rem', padding: 10, fontFamily: 'var(--font-mono)' }}>
                    No hay anuncios {sellerTab === 'raw' ? 'RAW' : 'GRADED'} para esta carta.
                  </div>
                  : sellerGroups.map(cond => {
                    const group = filteredListings.filter(l => l.condition === cond)
                    if (!group.length) return null
                    const headerId = `cg-${cond}`
                    const collapsed = !!collapsedGroups[headerId]
                    return (
                      <div key={cond} className="cond-group">
                        <div
                          className={`cg-header${collapsed ? ' collapsed' : ''}`}
                          onClick={() => toggleGroup(headerId)}
                        >
                          <span className="cg-label">
                            <span className="cg-arrow">▼</span> {COND_LABEL[cond] || cond} ({cond})
                          </span>
                          <span className="cg-meta">
                            <span className="cg-count">{group.length} vendedor{group.length > 1 ? 'es' : ''}</span>
                          </span>
                        </div>
                        {!collapsed && (
                          <div className="cg-body">
                            {group.map((l, i) => {
                              const price = parseFloat(l.price)
                              const isBest = i === 0
                              const below = basePrice && price <= parseFloat(basePrice)
                              return (
                                <div key={l.id} style={{
                                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px',
                                  border: `1px solid ${isBest ? 'rgba(212,245,60,0.2)' : 'var(--border)'}`,
                                  borderRadius: 6, marginBottom: 6,
                                  background: isBest ? 'rgba(212,245,60,0.04)' : 'var(--surface2)',
                                }}>
                                  <div
                                    style={{ flex: 1, cursor: 'pointer' }}
                                    onClick={() => router.push(`/perfil/${l.seller_id}`)}
                                  >
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                      Vendedor
                                      {isBest && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', background: 'rgba(212,245,60,0.12)', border: '1px solid rgba(212,245,60,0.3)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 3, letterSpacing: '0.5px' }}>MEJOR</span>}
                                    </div>
                                    <div style={{ fontSize: '0.62rem', color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>Ver perfil →</div>
                                  </div>
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--accent)' }}>€{price.toFixed(2)}</div>
                                    {basePrice && (
                                      <div style={{ fontSize: '0.6rem', color: below ? 'var(--nm)' : 'var(--mp)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                        {below ? '▼ bajo mercado' : '▲ sobre mercado'}
                                      </div>
                                    )}
                                  </div>
                                  <button className="buy-now-btn" onClick={() => goToCheckout(l.id)}>Comprar</button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
            </div>

            {/* BUY OFFERS */}
            <div className="buyers-hd" style={{ marginTop: 18 }}>
              OFERTAS DE COMPRA {modalBuyOffers.length > 0 && <span style={{ color: 'var(--text3)', fontWeight: 400, letterSpacing: 0 }}>({modalBuyOffers.length})</span>}
            </div>
            <div>
              {offersLoading
                ? <div style={{ color: 'var(--text3)', fontSize: '0.75rem', padding: 8, fontFamily: 'var(--font-mono)' }}>Cargando ofertas...</div>
                : modalBuyOffers.length === 0
                  ? <div style={{ color: 'var(--text3)', fontSize: '0.75rem', padding: 8, fontFamily: 'var(--font-mono)' }}>Sin ofertas de compra activas.</div>
                  : modalBuyOffers.map((o, i) => {
                    const isBest = i === 0
                    return (
                      <div key={o.id} className="buyer-row" style={isBest ? { borderColor: 'rgba(46,213,115,0.25)', background: 'rgba(46,213,115,0.03)' } : {}}>
                        <div>
                          <div className="buyer-price">
                            €{parseFloat(o.price).toFixed(2)}
                            {isBest && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', background: 'rgba(46,213,115,0.12)', border: '1px solid rgba(46,213,115,0.3)', color: 'var(--nm)', padding: '1px 5px', borderRadius: 3, marginLeft: 6 }}>MEJOR</span>}
                          </div>
                          <div className="buyer-cond">{COND_LABEL[o.condition] || o.condition}</div>
                        </div>
                        <button className="accept-offer-btn" onClick={() => acceptOffer(o.id, o.user_id, o.price)}>Aceptar</button>
                      </div>
                    )
                  })}
            </div>

            {/* MAKE OFFER BAR */}
            <div style={{ paddingTop: 14 }}>
              <button
                className="btn-accent"
                style={{ width: '100%', padding: '11px 0', fontSize: '0.73rem', letterSpacing: '1px' }}
                onClick={openMakeOffer}
              >+ HACER OFERTA</button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BUY NOW MODAL ────────────────────────────────────────────────── */}
      {buyListing && (
        <div className="modal-overlay open" style={{ zIndex: 600 }} onClick={e => { if (e.target === e.currentTarget) setBuyListing(null) }}>
          <div className="buy-modal">
            <div className="bm-header">
              <div className="bm-title">COMPRA DIRECTA</div>
              <button className="m-close" onClick={() => setBuyListing(null)}>✕</button>
            </div>
            <div className="bm-body">
              <div className="bm-card-summary">
                <div className="bm-card-thumb">
                  {modalCard?.image
                    ? <img src={modalCard.image + '/high.png'} alt="" />
                    : '🎴'}
                </div>
                <div className="bm-card-info">
                  <div className="bm-card-name">{modalCard?.name || '—'}</div>
                  <div className="bm-card-sub">
                    {COND_LABEL[buyListing.condition] || buyListing.condition} · {buyListing.display_type === 'slab' ? 'Slab' : 'Raw'}
                  </div>
                </div>
              </div>
              <div className="bm-section-title">VERIFICACIÓN</div>
              <div className="bm-verify-opts">
                {[
                  { id: 'none', icon: '—', name: 'Sin verif.', desc: 'Compra directa sin revisión', cost: 'Gratis' },
                  { id: 'ai', icon: '🤖', name: 'IA', desc: 'Análisis automático instantáneo', cost: '+2%' },
                  { id: 'human', icon: '👤', name: 'Manual', desc: 'Revisión por experto humano', cost: '+5%' },
                ].map(opt => (
                  <div
                    key={opt.id}
                    className={`bm-opt${verif === opt.id ? ' selected' : ''}`}
                    onClick={() => setVerif(opt.id)}
                  >
                    <div className="bmo-icon">{opt.icon}</div>
                    <div className="bmo-name">{opt.name}</div>
                    <div className="bmo-desc">{opt.desc}</div>
                    <div className="bmo-cost">{opt.cost}</div>
                  </div>
                ))}
              </div>
              <div className="bm-breakdown">
                <div className="bbd-row"><span>Precio carta</span><span>€{buyBase.toFixed(2)}</span></div>
                <div className="bbd-row"><span>Verificación</span><span>{verifRate > 0 ? `€${verifCost.toFixed(2)} (+${verifRate * 100}%)` : '€0.00'}</span></div>
                <div className="bbd-row bbd-total"><span>TOTAL</span><span>€{buyTotal.toFixed(2)}</span></div>
              </div>
              <button className="bm-confirm-btn" onClick={confirmBuy}>CONFIRMAR COMPRA</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MAKE OFFER MODAL ─────────────────────────────────────────────── */}
      {offerOpen && (
        <div className="modal-overlay open" style={{ zIndex: 600 }} onClick={e => { if (e.target === e.currentTarget) setOfferOpen(false) }}>
          <div className="offer-modal">
            <div className="bm-header">
              <div className="bm-title">HACER OFERTA</div>
              <button className="m-close" onClick={() => setOfferOpen(false)}>✕</button>
            </div>
            <div className="offer-modal-body">
              <div className="offer-field">
                <label>Tu precio (€)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  value={offerPrice}
                  onChange={e => setOfferPrice(e.target.value)}
                />
              </div>
              <div className="offer-field">
                <label>Condición</label>
                <select value={offerCond} onChange={e => setOfferCond(e.target.value)}>
                  <option value="NM">Near Mint (NM)</option>
                  <option value="LP">Lightly Played (LP)</option>
                  <option value="MP">Mod. Played (MP)</option>
                </select>
              </div>
              {offerMsg && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', marginBottom: 12, color: offerMsg.ok ? 'var(--nm)' : 'var(--mp)' }}>
                  {offerMsg.text}
                </div>
              )}
              <button className="offer-submit-btn" onClick={submitMakeOffer} disabled={offerLoading}>
                {offerLoading ? 'Publicando...' : 'PUBLICAR OFERTA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
