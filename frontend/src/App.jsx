import { useState, useEffect, useCallback, useMemo } from 'react'
import { io } from 'socket.io-client'
import Header from './components/Header'
import ActivityLog from './components/ActivityLog'
import StatusBadge from './components/StatusBadge'
import Sidebar from './components/Sidebar'
import SendMessage from './components/SendMessage'
import styles from './App.module.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

let socket = null

function App() {
  const [messages, setMessages] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [whatsappStatus, setWhatsappStatus] = useState('disconnected')
  const [whatsappQr, setWhatsappQr] = useState(null)
  const [activeContact, setActiveContact] = useState('')
  const [search, setSearch] = useState('')
  const [draftContact, setDraftContact] = useState('')
  const [unreadMap, setUnreadMap] = useState({})
  const [activeView, setActiveView] = useState('chats') // 'chats' or 'direct'

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/messages`)
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Fetch error:', err)
    }
  }, [])

  const conversations = useMemo(() => {
    const map = new Map()
    messages.forEach((msg) => {
      const raw = msg.contact || (msg.isMine ? msg.to : msg.from)
      if (!raw || raw.includes('@lid') || raw.includes('@g.us')) return
      const contact = raw.split('@')[0]
      const prev = map.get(contact)
      const pushName = msg.pushName || prev?.pushName || ''
      
      if (!prev) {
        map.set(contact, { contact, pushName, lastMessage: msg, messages: [msg] })
      } else {
        prev.pushName = pushName
        prev.lastMessage = msg
        prev.messages.push(msg)
      }
    })
    return Array.from(map.values()).sort((a, b) => {
      const at = new Date(a.lastMessage.createdAt || a.lastMessage.timestamp || 0).getTime()
      const bt = new Date(b.lastMessage.createdAt || b.lastMessage.timestamp || 0).getTime()
      return bt - at
    })
  }, [messages])

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter((c) => c.contact.toLowerCase().includes(q))
  }, [conversations, search])

  useEffect(() => {
    if (!activeContact && conversations.length > 0) {
      setActiveContact(conversations[0].contact)
    }
  }, [conversations, activeContact])

  useEffect(() => {
    if (activeContact) {
      setUnreadMap((prev) => {
        if (!prev[activeContact]) return prev
        const next = { ...prev }
        delete next[activeContact]
        return next
      })
    }
  }, [activeContact])

  useEffect(() => {
    if (messages.length === 0) return
    const last = messages[messages.length - 1]
    if (last && !last.isMine) {
      const raw = last.contact || last.from || ''
      if (!raw || raw.includes('@lid') || raw.includes('@g.us')) return
      const contact = raw.split('@')[0]
      if (contact && contact !== activeContact) {
        setUnreadMap((prev) => ({ ...prev, [contact]: (prev[contact] || 0) + 1 }))
      }
    }
  }, [messages, activeContact])

  useEffect(() => {
    fetchMessages()

    // Setup WebSocket
    socket = io(API_URL, { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      setIsConnected(true)
      console.log('✅ Connected to WebSocket')
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      console.log('❌ Disconnected from WebSocket')
    })

    socket.on('newMessage', () => {
      fetchMessages()
    })

    socket.on('statusUpdate', (state) => {
      console.log('📶 WhatsApp Status update:', state);
      setWhatsappStatus(state);
      if (state === 'open') setWhatsappQr(null); // Clear QR if connected
    })

    socket.on('qrUpdate', (qr) => {
      console.log('🖼️ New QR received via Socket');
      setWhatsappQr(qr);
    })

    return () => {
      socket?.off('statusUpdate');
      socket?.off('qrUpdate');
      socket?.disconnect();
    }
  }, [fetchMessages])

  const activeMessages = useMemo(() => {
    if (!activeContact) return []
    return messages.filter((m) => {
      const raw = m.contact || (m.isMine ? m.to : m.from)
      if (!raw || raw.includes('@lid') || raw.includes('@g.us')) return false
      const contact = raw.split('@')[0]
      return contact === activeContact
    })
  }, [messages, activeContact])

  return (
    <div className={styles.appContainer}>
      <div className={styles.mainContent}>
        <Header />
        <main className={styles.main}>
          <StatusBadge isConnected={isConnected} />
          <div className={styles.dashboardGrid}>
              <aside className={styles.leftRail}>
                <div className={styles.railLogo}>A</div>
                <button 
                  className={`${styles.railBtn} ${activeView === 'chats' ? styles.railBtnActive : ''}`} 
                  title="Chats"
                  onClick={() => setActiveView('chats')}
                >
                  💬
                </button>
                <button 
                  className={`${styles.railBtn} ${activeView === 'direct' ? styles.railBtnActive : ''}`} 
                  title="Direct Message"
                  onClick={() => setActiveView('direct')}
                >
                  ✉️
                </button>
                <button className={styles.railBtn} title="Settings">⚙️</button>
              <div className={styles.railSpacer} />
              <button className={styles.railBtn} title="Pin">📌</button>
            </aside>

            <section className={styles.listPanel}>
              <div className={styles.listHeader}>
                <div className={styles.listTitle}>
                  <span className={styles.listBadge} />
                  <div>
                    <div className={styles.listHeading}>aNquest Chat</div>
                    <div className={styles.listSub}>LIVE</div>
                  </div>
                </div>
                <Sidebar 
                  apiUrl={API_URL} 
                  status={whatsappStatus}
                  qrCode={whatsappQr}
                  compact
                />
              </div>

              <div className={styles.searchBox}>
                <span className={styles.searchIcon}>🔍</span>
                <input
                  className={styles.searchInput}
                  placeholder="Find a conversation..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className={styles.newChatRow}>
                <input
                  className={styles.newChatInput}
                  placeholder="Start chat with number..."
                  value={draftContact}
                  onChange={(e) => setDraftContact(e.target.value)}
                />
                <button
                  className={styles.newChatBtn}
                  onClick={() => {
                    const next = draftContact.trim()
                    if (!next) return
                    setActiveContact(next)
                    setDraftContact('')
                  }}
                >
                  New
                </button>
              </div>

              <div className={styles.chatList}>
                {filteredConversations.length === 0 && (
                  <div className={styles.emptyList}>No conversations yet</div>
                )}
                {filteredConversations.map((c) => {
                  const last = c.lastMessage
                  const time = last?.timestamp || ''
                  const isActive = c.contact === activeContact
                  const unread = unreadMap[c.contact] || 0
                  return (
                    <button
                      key={c.contact}
                      className={`${styles.chatItem} ${isActive ? styles.chatItemActive : ''}`}
                      onClick={() => setActiveContact(c.contact)}
                    >
                      <div className={styles.chatAvatar}>{(c.pushName || c.contact)[0]?.toUpperCase() || 'U'}</div>
                      <div className={styles.chatMeta}>
                        <div className={styles.chatTopRow}>
                          <div className={styles.chatName}>{c.pushName || c.contact}</div>
                          <div className={styles.chatTime}>{time}</div>
                        </div>
                        <div className={styles.chatPreview}>
                          {last?.content || 'No messages yet'}
                        </div>
                      </div>
                      {unread > 0 && <div className={styles.unread}>{unread}</div>}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className={styles.chatSection}>
              {activeView === 'chats' ? (
                <ActivityLog
                  messages={activeMessages}
                  onRefresh={fetchMessages}
                  apiUrl={API_URL}
                  activeContact={activeContact}
                  activeName={conversations.find(c => c.contact === activeContact)?.pushName}
                />
              ) : (
                <div className={styles.centerContainer}>
                  <SendMessage 
                    apiUrl={API_URL} 
                    onMessageSent={() => {
                      fetchMessages();
                      setActiveView('chats');
                    }} 
                  />
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
