'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SHIPPING_OPTIONS = [
  { id: 'standard', label: 'Envío estándar', desc: 'Correos certificado', days: '3–5 días', price: 3.50 },
  { id: 'express', label: 'Envío exprés', desc: 'MRW 24h garantizado', days: '24h', price: 6.90 },
  { id: 'pickup', label: 'Recogida en mano', desc: 'Acordar punto de encuentro', days: '—', price: 0 },
]

const VERIFICATION_OPTIONS = [
  { id: 'none', label: 'Sin verificación', desc: 'Compra directa sin revisión', fee: 0, feeLabel: 'Gratis' },
  { id: 'ai', label: 'Verificación IA', desc: 'Revisión automática con IA (24–48h)', fee: 0.02, feeLabel: '2% del precio' },
  { id: 'human', label: 'Verificación humana', desc: 'Revisión por experto certificado (2–4 días)', fee: 0.05, feeLabel: '5% del precio' },
  { id: 'beckett', label: 'Gradeo Beckett', desc: 'Gradeo oficial BGS (3–6 semanas)', fee: 25, feeLabel: '€25 fijo' },
]

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const listingId = searchParams.get('listing_id')

  const [user, setUser] = useState(null)
  const [listing, setListing] = useState(null)
  const [seller, setSeller] = useState(null)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [shipping, setShipping] = useState('standard')
  const [verification, setVerification] = useState('none')

  useEffect(() => {
    if (!listingId) { router.push('/'); return }
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      const { data: lst } = await sb.from('listings')
        .select('*, profiles:seller_id(username, bio)')
        .eq('id', listingId)
        .single()
      if (!lst) { router.push('/'); return }
      setListing(lst)
      setSeller(lst.profiles)
      setLoading(false)
    })
  }, [listingId, router])

  const shippingOpt = SHIPPING_OPTIONS.find(o => o.id === shipping) || SHIPPING_OPTIONS[0]
  const verOpt = VERIFICATION_OPTIONS.find(o => o.id === verification) || VERIFICATION_OPTIONS[0]

  const cardPrice = parseFloat(listing?.price || 0)
  const shippingPrice = shippingOpt.price
  const verificationFee = verOpt.fee <= 1 ? cardPrice * verOpt.fee : verOpt.fee
  const buyerProtectionFee = cardPrice * 0.03
  const total = cardPrice + shippingPrice + verificationFee + buyerProtectionFee

  const condColor = { NM: '#2ed573', LP: '#ffa502', MP: '#ff4757', PSA10: '#d4f53c', PSA9: '#38bdf8', PSA8: '#a78bfa' }
  const condBg = { NM: 'rgba(46,213,115,0.12)', LP: 'rgba(255,165,2,0.12)', MP: 'rgba(255,71,87,0.12)', PSA10: 'rgba(212,245,60,0.1)', PSA9: 'rgba(56,189,248,0.1)', PSA8: 'rgba(167,139,250,0.1)' }

  const placeOrder = async () => {
    if (!user || !listing) return
    setPlacing(true)
    const sb = createClient()
    await sb.from('profiles').upsert({ id: user.id, username: user.email?.split('@')[0] || user.id.slice(0, 8) }, { onConflict: 'id' })
    const { data: order, error } = await sb.from('orders').insert({
      buyer_id: user.id,
      seller_id: listing.seller_id,
      listing_id: listing.id,
      card_id: listing.card_id,
      price_card: cardPrice,
      shipping_price: shippingPrice,
      verification_type: verification,
      verification_fee: verificationFee,
      buyer_protection_fee: buyerProtectionFee,
      total_price: total,
      status: 'pending',
    }).select('id').single()
    if (!error && order) {
      await sb.from('listings').update({ sold: true }).eq('id', listing.id)
      router.push(`/confirmacion?order_id=${order.id}`)
    } else {
      setPlacing(false)
    }
  }

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '3px', marginBottom: '4px' }}>CHECKOUT</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '32px' }}>Completa tu pedido de forma segura</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card summary */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '60px', height: '84px', borderRadius: '6px', background: 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {listing.card_image
                ? <img src={listing.card_image} alt={listing.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px', padding: '3px' }} onError={e => e.target.style.display='none'} />
                : <span style={{ fontSize: '1.8rem' }}>🎴</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', letterSpacing: '1px', marginBottom: '4px' }}>{listing.card_name}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '10px' }}>{listing.card_set}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {listing.condition && (
                  <span style={{ background: condBg[listing.condition] || '', border: `1px solid ${condColor[listing.condition] || 'var(--border)'}`, color: condColor[listing.condition] || 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem', fontWeight: 700, padding: '3px 9px', borderRadius: '4px' }}>
                    {listing.condition}
                  </span>
                )}
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)' }}>
                  {listing.display_type === 'slab' ? '· Slab gradeado' : '· Raw'}
                </span>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '1px', color: 'var(--accent)' }}>€{cardPrice.toFixed(2)}</div>
          </div>

          {/* Seller info */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', letterSpacing: '1px', marginBottom: '12px', color: 'var(--text2)' }}>VENDEDOR</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#3d2a6e,#d4f53c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#08080d' }}>
                {(seller?.username || '?')[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text)' }}>{seller?.username || '—'}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>Particular</div>
              </div>
            </div>
          </div>

          {/* Shipping */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px', marginBottom: '16px' }}>ENVÍO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {SHIPPING_OPTIONS.map(opt => (
                <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: `1px solid ${shipping === opt.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', background: shipping === opt.id ? 'rgba(212,245,60,0.05)' : 'transparent', transition: 'all 0.15s' }}>
                  <input type="radio" name="shipping" value={opt.id} checked={shipping === opt.id} onChange={() => setShipping(opt.id)} style={{ accentColor: 'var(--accent)', width: '16px', height: '16px', cursor: 'pointer' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{opt.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)' }}>{opt.desc} · {opt.days}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.5px', color: opt.price === 0 ? '#2ed573' : 'var(--text)' }}>
                    {opt.price === 0 ? 'Gratis' : `€${opt.price.toFixed(2)}`}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Verification */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px', marginBottom: '4px' }}>VERIFICACIÓN</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginBottom: '16px' }}>Añade una capa de protección a tu compra</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {VERIFICATION_OPTIONS.map(opt => (
                <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: `1px solid ${verification === opt.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', background: verification === opt.id ? 'rgba(212,245,60,0.05)' : 'transparent', transition: 'all 0.15s' }}>
                  <input type="radio" name="verification" value={opt.id} checked={verification === opt.id} onChange={() => setVerification(opt.id)} style={{ accentColor: 'var(--accent)', width: '16px', height: '16px', cursor: 'pointer' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{opt.label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)' }}>{opt.desc}</div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: opt.fee === 0 ? '#2ed573' : 'var(--accent)' }}>{opt.feeLabel}</div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div style={{ position: 'sticky', top: '80px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', letterSpacing: '1px', marginBottom: '20px' }}>RESUMEN DEL PEDIDO</div>
            {[
              ['Precio de la carta', `€${cardPrice.toFixed(2)}`],
              ['Envío', shippingPrice === 0 ? 'Gratis' : `€${shippingPrice.toFixed(2)}`],
              ['Verificación', verificationFee === 0 ? 'Gratis' : `€${verificationFee.toFixed(2)}`],
              ['Protección al comprador (3%)', `€${buyerProtectionFee.toFixed(2)}`],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text3)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text)' }}>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', marginTop: '4px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px' }}>TOTAL</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '1px', color: 'var(--accent)' }}>€{total.toFixed(2)}</span>
            </div>
            <button onClick={placeOrder} disabled={placing}
              style={{ width: '100%', padding: '14px', border: 'none', borderRadius: '8px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '2px', fontWeight: 700, cursor: placing ? 'wait' : 'pointer', opacity: placing ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {placing ? 'PROCESANDO...' : 'CONFIRMAR PEDIDO'}
            </button>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)', textAlign: 'center', marginTop: '12px', lineHeight: 1.6 }}>
              🔒 Pago protegido · Tu dinero queda en custodia hasta la entrega verificada
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando...</div>}>
      <CheckoutContent />
    </Suspense>
  )
}
