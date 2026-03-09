'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ConfirmacionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get('order_id')
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orderId) { router.push('/'); return }
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      const { data } = await sb.from('orders')
        .select('*, listing:listing_id(card_name, card_set, card_image, condition, display_type), seller:seller_id(username), buyer:buyer_id(username)')
        .eq('id', orderId)
        .single()
      setOrder(data)
      setLoading(false)
    })
  }, [orderId, router])

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando confirmación...</div>

  if (!order) return (
    <div style={{ padding: '80px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', marginBottom: '16px' }}>Pedido no encontrado.</div>
      <button onClick={() => router.push('/')} style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Ir al marketplace</button>
    </div>
  )

  const condColor = { NM: '#2ed573', LP: '#ffa502', MP: '#ff4757', PSA10: '#d4f53c', PSA9: '#38bdf8', PSA8: '#a78bfa' }

  const rows = [
    ['Nº de pedido', `#${order.id.slice(0, 8).toUpperCase()}`],
    ['Vendedor', order.seller?.username || '—'],
    ['Carta', order.listing?.card_name || '—'],
    ['Set', order.listing?.card_set || '—'],
    order.listing?.condition ? ['Condición', order.listing.condition] : null,
    order.verification_type && order.verification_type !== 'none' ? ['Verificación', order.verification_type.toUpperCase()] : null,
    ['Total pagado', `€${parseFloat(order.total_price || order.price_card || order.price || 0).toFixed(2)}`],
    ['Estado', 'Pendiente de envío'],
    ['Fecha', new Date(order.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })],
  ].filter(Boolean)

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: 'var(--bg)' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>
        {/* Success icon */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(46,213,115,0.12)', border: '2px solid #2ed573', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '2.4rem' }}>
            ✓
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '2.4rem', letterSpacing: '3px', color: '#2ed573', marginBottom: '8px' }}>¡PEDIDO CONFIRMADO!</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)', lineHeight: 1.7 }}>
            Tu pedido ha sido registrado correctamente.<br />Recibirás una notificación cuando el vendedor envíe la carta.
          </div>
        </div>

        {/* Card preview */}
        {order.listing?.card_image && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ position: 'relative' }}>
              <img src={order.listing.card_image} alt={order.listing.card_name}
                style={{ width: '100px', height: '140px', objectFit: 'contain', borderRadius: '8px', border: '1px solid var(--border)' }}
                onError={e => e.target.style.display='none'} />
              {order.listing.condition && (
                <span style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(8,8,13,0.8)', border: `1px solid ${condColor[order.listing.condition] || 'var(--border)'}`, color: condColor[order.listing.condition] || 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.58rem', fontWeight: 700, padding: '2px 6px', borderRadius: '3px' }}>
                  {order.listing.condition}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Order details */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '1px' }}>DETALLES DEL PEDIDO</div>
          </div>
          <div style={{ padding: '4px 0' }}>
            {rows.map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text3)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: label === 'Total pagado' ? 'var(--accent)' : label === 'Estado' ? '#ffa502' : 'var(--text)', fontWeight: label === 'Total pagado' ? 700 : 400 }}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Buyer protection banner */}
        <div style={{ background: 'rgba(46,213,115,0.06)', border: '1px solid rgba(46,213,115,0.2)', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>🛡️</span>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 600, color: '#2ed573', marginBottom: '4px' }}>Protección al comprador activa</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', lineHeight: 1.6 }}>Tu pago está en custodia. Si la carta no llega o no coincide con la descripción, te reembolsamos el 100%.</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => router.push('/seguimiento')}
            style={{ width: '100%', padding: '13px', border: 'none', borderRadius: '8px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '2px', fontWeight: 700, cursor: 'pointer' }}>
            VER MIS PEDIDOS
          </button>
          <button onClick={() => router.push('/')}
            style={{ width: '100%', padding: '13px', border: '1px solid var(--border)', borderRadius: '8px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>
            Seguir comprando
          </button>
          <button onClick={() => router.push('/mensajes')}
            style={{ width: '100%', padding: '13px', border: '1px solid var(--border)', borderRadius: '8px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>
            💬 Contactar al vendedor
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmacionPage() {
  return (
    <Suspense fallback={<div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando...</div>}>
      <ConfirmacionContent />
    </Suspense>
  )
}
