import { useState, useEffect, useCallback } from 'react'
import { io } from 'socket.io-client'
import Header from './components/Header'
import SendMessage from './components/SendMessage'
import ActivityLog from './components/ActivityLog'
import StatusBadge from './components/StatusBadge'
import Sidebar from './components/Sidebar'
import styles from './App.module.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

let socket = null

function App() {
  const [messages, setMessages] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/messages`)
      const data = await res.json()
      setMessages(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Fetch error:', err)
    }
  }, [])

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

    return () => {
      socket?.disconnect()
    }
  }, [fetchMessages])

  return (
    <div className={styles.appContainer}>
      <aside className={styles.sidebarSection}>
        <Sidebar apiUrl={API_URL} />
      </aside>
      <div className={styles.mainContent}>
        <Header />
        <main className={styles.main}>
          <StatusBadge isConnected={isConnected} />
          <div className={styles.dashboardGrid}>
            <div className={styles.sendSection}>
              <SendMessage
                apiUrl={API_URL}
                onMessageSent={fetchMessages}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
            </div>
            <div className={styles.chatSection}>
              <ActivityLog
                messages={messages}
                onRefresh={fetchMessages}
                apiUrl={API_URL}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
