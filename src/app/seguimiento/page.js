'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STATUS_STEPS = ['pending', 'shipped', 'delivered']
const STATUS_LABEL = { pending: 'Pendiente', pending_payment: 'Pago pendiente', shipped: 'Enviado', delivered: 'Entregado' }
const STATUS_COLOR = { pending_payment: '#ffa502', pending: '#ffa502', shipped: '#38bdf8', delivered: '#2ed573' }

export default function SeguimientoPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [buyOrders, setBuyOrders] = useState([])
  const [sellOrders, setSellOrders] = useState([])
  const [tab, setTab] = useState('compras')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      const [{ data: buy }, { data: sell }] = await Promise.all([
        sb.from('orders').select('*, listing:listing_id(card_name, card_set, card_image, condition), seller:seller_id(username)')
          .eq('buyer_id', user.id).order('created_at', { ascending: false }),
        sb.from('orders').select('*, listing:listing_id(card_name, card_set, card_image, condition), buyer:buyer_id(username)')
          .eq('seller_id', user.id).order('created_at', { ascending: false }),
      ])
      setBuyOrders(buy || [])
      setSellOrders(sell || [])
      setLoading(false)
    })
  }, [router])

  const markShipped = async (orderId) => {
    setUpdating(orderId)
    const sb = createClient()
    await sb.from('orders').update({ status: 'shipped' }).eq('id', orderId)
    setSellOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'shipped' } : o))
    setUpdating(null)
  }

  const markDelivered = async (orderId) => {
    setUpdating(orderId)
    const sb = createClient()
    await sb.from('orders').update({ status: 'delivered' }).eq('id', orderId)
    setBuyOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o))
    setSellOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'delivered' } : o))
    setUpdating(null)
  }

  const condColor = { NM: '#2ed573', LP: '#ffa502', MP: '#ff4757', PSA10: '#d4f53c', PSA9: '#38bdf8', PSA8: '#a78bfa' }

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando pedidos...</div>

  const orders = tab === 'compras' ? buyOrders : sellOrders

  const OrderCard = ({ order, isSeller }) => {
    const card = order.listing
    const partner = isSeller ? order.buyer : order.seller
    const price = order.total_price || order.price_card || order.price || 0
    const stepIdx = STATUS_STEPS.indexOf(order.status)

    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', marginBottom: '14px' }}>
        {/* Header */}
        <div style={{ background: 'var(--surface2)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)' }}>
            #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleDateString('es-ES')}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 600, color: STATUS_COLOR[order.status] || 'var(--text2)', background: `${STATUS_COLOR[order.status]}18` || 'rgba(152,152,184,0.1)', padding: '3px 10px', borderRadius: '20px', border: `1px solid ${STATUS_COLOR[order.status]}40` }}>
            {STATUS_LABEL[order.status] || order.status}
          </span>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          {/* Card image */}
          <div style={{ width: '52px', height: '72px', borderRadius: '5px', background: 'linear-gradient(135deg,#13132a,#1a1a35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {card?.card_image
              ? <img src={card.card_image} alt={card.card_name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '5px', padding: '2px' }} onError={e => e.target.style.display='none'} />
              : <span style={{ fontSize: '1.4rem' }}>🎴</span>}
          </div>

          {/* Info */}
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.5px', marginBottom: '2px' }}>{card?.card_name || 'Carta'}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', marginBottom: '8px' }}>{card?.card_set || '—'}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {card?.condition && (
                <span style={{ border: `1px solid ${condColor[card.condition] || 'var(--border)'}`, color: condColor[card.condition] || 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', fontWeight: 700, padding: '2px 7px', borderRadius: '3px' }}>
                  {card.condition}
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)' }}>
                {isSeller ? `Comprador: ${partner?.username || '—'}` : `Vendedor: ${partner?.username || '—'}`}
              </span>
            </div>
          </div>

          {/* Price */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', letterSpacing: '1px', color: 'var(--accent)' }}>€{parseFloat(price).toFixed(2)}</div>
          </div>
        </div>

        {/* Progress tracker */}
        {order.status !== 'pending_payment' && (
          <div style={{ padding: '0 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {STATUS_STEPS.map((step, i) => {
                const done = stepIdx >= i
                const current = stepIdx === i
                return (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_STEPS.length - 1 ? 1 : 'none' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: done ? 'var(--accent)' : 'var(--surface2)', border: `2px solid ${done ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: done ? '#08080d' : 'var(--text3)', fontWeight: 700, transition: 'all 0.3s' }}>
                        {done ? '✓' : i + 1}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.56rem', color: done ? 'var(--accent)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                        {STATUS_LABEL[step] || step}
                      </div>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div style={{ flex: 1, height: '2px', background: stepIdx > i ? 'var(--accent)' : 'var(--border)', margin: '0 4px', marginBottom: '16px', transition: 'background 0.3s' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        {(isSeller && order.status === 'pending') || (!isSeller && order.status === 'shipped') ? (
          <div style={{ padding: '0 20px 16px', display: 'flex', gap: '10px' }}>
            {isSeller && order.status === 'pending' && (
              <button onClick={() => markShipped(order.id)} disabled={updating === order.id}
                style={{ padding: '9px 20px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', opacity: updating === order.id ? 0.6 : 1 }}>
                {updating === order.id ? 'Actualizando...' : '📦 Marcar como enviado'}
              </button>
            )}
            {!isSeller && order.status === 'shipped' && (
              <button onClick={() => markDelivered(order.id)} disabled={updating === order.id}
                style={{ padding: '9px 20px', border: 'none', borderRadius: '6px', background: '#2ed573', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer', opacity: updating === order.id ? 0.6 : 1 }}>
                {updating === order.id ? 'Actualizando...' : '✓ Confirmar recepción'}
              </button>
            )}
            <button onClick={() => router.push('/mensajes')}
              style={{ padding: '9px 20px', border: '1px solid var(--border)', borderRadius: '6px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', cursor: 'pointer' }}>
              💬 Contactar
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px 80px' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', letterSpacing: '3px', marginBottom: '4px' }}>MIS PEDIDOS</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text3)', marginBottom: '28px' }}>Seguimiento de compras y ventas</div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: '24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px', width: 'fit-content' }}>
        {[['compras', `Mis compras (${buyOrders.length})`], ['ventas', `Mis ventas (${sellOrders.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', background: tab === key ? 'var(--accent)' : 'none', color: tab === key ? '#08080d' : 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: tab === key ? 700 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Orders */}
      {orders.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', border: '1.5px dashed var(--border)', borderRadius: '10px' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📦</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)', marginBottom: '16px' }}>
            {tab === 'compras' ? 'Aún no has realizado ninguna compra.' : 'Aún no tienes ventas registradas.'}
          </div>
          {tab === 'compras' && (
            <button onClick={() => router.push('/')} style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
              Explorar marketplace
            </button>
          )}
          {tab === 'ventas' && (
            <button onClick={() => router.push('/vender')} style={{ padding: '10px 24px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
              Publicar carta
            </button>
          )}
        </div>
      ) : (
        orders.map(order => <OrderCard key={order.id} order={order} isSeller={tab === 'ventas'} />)
      )}
    </div>
  )
}
