import { useState } from 'react'
import styles from './SendMessage.module.css'

export default function SendMessage({ apiUrl, onMessageSent }) {
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus({ type: 'info', text: 'Sending message...' })

    try {
      const res = await fetch(`${apiUrl}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, message }),
      })
      const data = await res.json()

      if (data.success) {
        setStatus({ type: 'success', text: '✅ Message sent successfully!' })
        setMessage('')
        onMessageSent?.()
      } else {
        throw new Error(data.error || 'Failed to send message')
      }
    } catch (err) {
      setStatus({ type: 'error', text: `❌ Error: ${err.message}` })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>✉️</span>
        <h2 className={styles.cardTitle}>Send New Message</h2>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="phone">
            Phone Number
          </label>
          <input
            id="phone"
            className={styles.input}
            type="text"
            placeholder="e.g. 919876543210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="message">
            Message
          </label>
          <textarea
            id="message"
            className={styles.textarea}
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
        </div>

        {status.text && (
          <div className={`${styles.status} ${styles[status.type]}`}>
            {status.text}
          </div>
        )}

        <button
          type="submit"
          className={styles.btn}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className={styles.spinner} />
              Sending...
            </>
          ) : (
            <>📤 Send Message</>
          )}
        </button>
      </form>
    </section>
  )
}
