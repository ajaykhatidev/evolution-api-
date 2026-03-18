import styles from './StatusBadge.module.css'

export default function StatusBadge({ isConnected }) {
  return (
    <div className={`${styles.badge} ${isConnected ? styles.connected : styles.disconnected}`}>
      <span className={styles.dot} />
      <span className={styles.text}>
        {isConnected ? 'Real-time connected' : 'Connecting...'}
      </span>
    </div>
  )
}
