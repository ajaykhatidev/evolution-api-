import styles from './ActivityLog.module.css'

function MessageItem({ msg }) {
  const isSent = msg.isMine
  const formatted = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return (
    <div className={`${styles.item} ${isSent ? styles.sent : styles.received}`}>
      <div className={styles.meta}>
        <span className={styles.direction}>
          {isSent ? `📤 To: ${msg.to}` : `📥 From: ${msg.from}`}
        </span>
        <span className={styles.time}>{formatted}</span>
      </div>
      <p className={styles.content}>{msg.content}</p>
    </div>
  )
}

export default function ActivityLog({ messages, onRefresh }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.left}>
          <span className={styles.cardIcon}>📋</span>
          <h2 className={styles.cardTitle}>Activity Log</h2>
          {messages.length > 0 && (
            <span className={styles.badge}>{messages.length}</span>
          )}
        </div>
        <button className={styles.refreshBtn} onClick={onRefresh}>
          🔄 Refresh
        </button>
      </div>

      <div className={styles.logContainer}>
        {messages.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>💬</span>
            <p>No messages received yet.</p>
            <small>Messages will appear here in real-time.</small>
          </div>
        ) : (
          [...messages].reverse().map((msg, i) => (
            <MessageItem key={msg.id || i} msg={msg} />
          ))
        )}
      </div>
    </section>
  )
}
