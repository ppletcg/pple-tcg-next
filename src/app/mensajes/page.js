'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function MensajesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [onlineUsers, setOnlineUsers] = useState({})
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [offerModal, setOfferModal] = useState(false)
  const [offerPrice, setOfferPrice] = useState('')
  const [profiles, setProfiles] = useState({})
  const messagesEndRef = useRef(null)
  const msgChannelRef = useRef(null)
  const presenceChannelRef = useRef(null)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth'); return }
      setUser(user)
      await loadConversations(sb, user)
      setLoading(false)
      // presence
      const pc = sb.channel('online-users')
      pc.on('presence', { event: 'sync' }, () => {
        const state = pc.presenceState()
        const online = {}
        Object.values(state).flat().forEach(p => { online[p.user_id] = true })
        setOnlineUsers(online)
      }).subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await pc.track({ user_id: user.id })
        }
      })
      presenceChannelRef.current = pc
    })
    return () => {
      if (msgChannelRef.current) msgChannelRef.current.unsubscribe()
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe()
    }
  }, [router])

  const loadConversations = async (sb, user) => {
    const { data } = await sb.from('conversations')
      .select(`id, buyer_id, seller_id, listing_id, updated_at,
               listing:listing_id(id, card_id, card_name, card_set, card_image, condition, price, display_type)`)
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('updated_at', { ascending: false })
    if (!data) return
    setConversations(data)
    // load profiles for all participants
    const ids = [...new Set(data.flatMap(c => [c.buyer_id, c.seller_id]).filter(Boolean))]
    if (ids.length) {
      const { data: profs } = await sb.from('profiles').select('id, username').in('id', ids)
      const map = {}
      profs?.forEach(p => { map[p.id] = p })
      setProfiles(map)
    }
    // auto-select from URL or first
    const convIdParam = searchParams.get('conv_id')
    const target = convIdParam ? data.find(c => c.id === convIdParam) : data[0]
    if (target) selectConversation(target, sb, user)
  }

  const selectConversation = useCallback(async (conv, sbArg, userArg) => {
    const sb = sbArg || createClient()
    const u = userArg || user
    setActiveConv(conv)
    // unsubscribe old channel
    if (msgChannelRef.current) { msgChannelRef.current.unsubscribe(); msgChannelRef.current = null }
    // load messages
    const { data } = await sb.from('messages')
      .select('id, sender_id, text, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    // subscribe realtime
    const ch = sb.channel('messages-' + conv.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conv.id}`
      }, payload => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
      })
      .subscribe()
    msgChannelRef.current = ch
  }, [user])

  const sendMessage = async () => {
    if (!input.trim() || !activeConv || !user) return
    setSending(true)
    const sb = createClient()
    const text = input.trim()
    setInput('')
    await sb.from('messages').insert({ conversation_id: activeConv.id, sender_id: user.id, text })
    await sb.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.id)
    setSending(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const submitOffer = async () => {
    if (!offerPrice || !activeConv || !user) return
    const sb = createClient()
    const price = parseFloat(offerPrice)
    if (isNaN(price) || price <= 0) return
    const listing = activeConv.listing
    await sb.from('messages').insert({
      conversation_id: activeConv.id,
      sender_id: user.id,
      text: `💰 Oferta enviada: €${price.toFixed(2)} por ${listing?.card_name || 'la carta'}`
    })
    await sb.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConv.id)
    setOfferModal(false)
    setOfferPrice('')
  }

  const buyNow = async () => {
    if (!activeConv?.listing || !user) return
    const listing = activeConv.listing
    const sb = createClient()
    await sb.from('profiles').upsert({ id: user.id, username: user.email?.split('@')[0] || user.id.slice(0, 8) }, { onConflict: 'id' })
    const { data: order } = await sb.from('orders').insert({
      buyer_id: user.id,
      seller_id: activeConv.seller_id,
      listing_id: listing.id,
      card_id: listing.card_id,
      price: listing.price,
      status: 'pending',
    }).select('id').single()
    await sb.from('listings').update({ sold: true }).eq('id', listing.id)
    if (order) router.push(`/confirmacion?order_id=${order.id}`)
  }

  const getOtherUser = (conv) => {
    if (!user) return null
    const otherId = conv.buyer_id === user.id ? conv.seller_id : conv.buyer_id
    return profiles[otherId]
  }

  const formatTime = (ts) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (ts) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = (now - d) / 1000
    if (diff < 60) return 'Ahora'
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  }

  const condColor = { NM: '#2ed573', LP: '#ffa502', MP: '#ff4757', PSA10: '#d4f53c', PSA9: '#38bdf8', PSA8: '#a78bfa' }

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando mensajes...</div>

  const listing = activeConv?.listing
  const otherUser = activeConv ? getOtherUser(activeConv) : null
  const otherName = otherUser?.username || '—'
  const isOnline = otherUser ? !!onlineUsers[activeConv?.buyer_id === user?.id ? activeConv?.seller_id : activeConv?.buyer_id] : false

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', background: 'var(--bg)' }}>
      {/* Conversations list */}
      <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg2)' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '2px', marginBottom: '12px' }}>MENSAJES</div>
          <input
            placeholder="Buscar conversación..."
            style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {conversations.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)' }}>
              Sin conversaciones aún.<br />Compra o vende una carta para empezar.
            </div>
          )}
          {conversations.map(conv => {
            const other = getOtherUser(conv)
            const name = other?.username || '—'
            const isActive = activeConv?.id === conv.id
            const online = other ? !!onlineUsers[conv.buyer_id === user?.id ? conv.seller_id : conv.buyer_id] : false
            return (
              <div key={conv.id} onClick={() => selectConversation(conv)}
                style={{ padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: isActive ? 'var(--surface2)' : 'transparent', borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent', transition: 'background 0.15s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,#3d2a6e,#d4f53c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#08080d' }}>
                      {name[0]?.toUpperCase() || '?'}
                    </div>
                    {online && <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '9px', height: '9px', borderRadius: '50%', background: '#2ed573', border: '2px solid var(--bg2)' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)' }}>{name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>{formatDate(conv.updated_at)}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.listing?.card_name || 'Carta'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Chat panel */}
      {activeConv ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Chat header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--bg2)' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg,#3d2a6e,#d4f53c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: '#08080d' }}>
                {otherName[0]?.toUpperCase() || '?'}
              </div>
              {isOnline && <div style={{ position: 'absolute', bottom: '1px', right: '1px', width: '10px', height: '10px', borderRadius: '50%', background: '#2ed573', border: '2px solid var(--bg2)' }} />}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)' }}>{otherName}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: isOnline ? '#2ed573' : 'var(--text3)' }}>
                {isOnline ? '● En línea' : '○ Desconectado'}
              </div>
            </div>
          </div>

          {/* Card context bar */}
          {listing && (
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {listing.card_image && (
                <img src={`${listing.card_image}/high.webp`} alt={listing.card_name} style={{ width: '36px', height: '50px', objectFit: 'contain', borderRadius: '4px' }} onError={e => e.target.style.display='none'} />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>{listing.card_name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--text3)' }}>
                  {listing.card_set}
                  {listing.condition && <span style={{ marginLeft: '8px', color: condColor[listing.condition] || 'var(--text2)' }}>{listing.condition}</span>}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--accent)', letterSpacing: '0.5px' }}>€{parseFloat(listing.price || 0).toFixed(2)}</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {activeConv.buyer_id === user?.id && (
                  <>
                    <button onClick={() => setOfferModal(true)}
                      style={{ padding: '7px 14px', border: '1px solid var(--border2)', borderRadius: '5px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', cursor: 'pointer' }}>
                      Hacer oferta
                    </button>
                    <button onClick={buyNow}
                      style={{ padding: '7px 14px', border: 'none', borderRadius: '5px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>
                      Comprar ahora
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.length === 0 && (
              <div style={{ margin: 'auto', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)' }}>
                Empieza la conversación con {otherName}
              </div>
            )}
            {messages.map(msg => {
              const isMine = msg.sender_id === user?.id
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '65%' }}>
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: isMine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      background: isMine ? 'var(--accent)' : 'var(--surface)',
                      border: isMine ? 'none' : '1px solid var(--border)',
                      color: isMine ? '#08080d' : 'var(--text)',
                      fontFamily: 'var(--font-body)',
                      fontSize: '0.82rem',
                      lineHeight: 1.5,
                    }}>
                      {msg.text}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', color: 'var(--text3)', textAlign: isMine ? 'right' : 'left', marginTop: '4px', paddingInline: '4px' }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe un mensaje... (Enter para enviar)"
              rows={1}
              style={{ flex: 1, padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: '0.82rem', outline: 'none', resize: 'none', lineHeight: 1.5 }}
            />
            <button onClick={sendMessage} disabled={sending || !input.trim()}
              style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', background: input.trim() ? 'var(--accent)' : 'var(--surface)', color: input.trim() ? '#08080d' : 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>
              Enviar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '3rem' }}>💬</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', letterSpacing: '2px', color: 'var(--text2)' }}>SELECCIONA UNA CONVERSACIÓN</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text3)' }}>O compra una carta en el marketplace para empezar</div>
        </div>
      )}

      {/* Offer modal */}
      {offerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,8,13,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={e => { if (e.target === e.currentTarget) setOfferModal(false) }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: '14px', padding: '32px', width: '360px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', letterSpacing: '2px', marginBottom: '8px' }}>HACER OFERTA</div>
            {listing && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '20px' }}>
                {listing.card_name} · Precio actual: €{parseFloat(listing.price).toFixed(2)}
              </div>
            )}
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--accent)', pointerEvents: 'none' }}>€</span>
              <input
                type="number"
                value={offerPrice}
                onChange={e => setOfferPrice(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                style={{ width: '100%', padding: '12px 12px 12px 28px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: '8px', color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: '1.6rem', letterSpacing: '1px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setOfferModal(false)}
                style={{ flex: 1, padding: '11px', border: '1px solid var(--border)', borderRadius: '6px', background: 'none', color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={submitOffer}
                style={{ flex: 1, padding: '11px', border: 'none', borderRadius: '6px', background: 'var(--accent)', color: '#08080d', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                Enviar oferta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MensajesPage() {
  return (
    <Suspense fallback={<div style={{ padding: '80px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text3)' }}>Cargando mensajes...</div>}>
      <MensajesContent />
    </Suspense>
  )
}
