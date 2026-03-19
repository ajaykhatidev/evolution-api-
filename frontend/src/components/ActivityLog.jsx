import { useEffect, useRef, useState } from 'react';
import styles from './ActivityLog.module.css';

function MessageItem({ msg, onReply }) {
  const isSent = msg.isMine;
  
  let timeStr = msg.timestamp;
  try {
    if (!isNaN(Date.parse(msg.timestamp))) {
      timeStr = new Date(msg.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch (e) {}

  return (
    <div className={`${styles.messageWrapper} ${isSent ? styles.sentWrapper : styles.receivedWrapper}`}>
      <div className={`${styles.bubble} ${isSent ? styles.sentBubble : styles.receivedBubble}`}>
        {!isSent && (
          <div className={styles.bubbleHeader}>
            <div className={styles.sender}>{msg.from}</div>
            <button className={styles.replyMiniBtn} onClick={() => onReply(msg.from)} title="Reply">
              ↩️
            </button>
          </div>
        )}
        <div className={styles.content}>{msg.content}</div>
        <div className={styles.meta}>
          <span className={styles.time}>{timeStr}</span>
          {isSent && <span className={styles.status}>✓✓</span>}
        </div>
      </div>
    </div>
  );
}

export default function ActivityLog({ messages, onRefresh, apiUrl }) {
  const scrollRef = useRef(null);
  const [replyText, setReplyText] = useState('');
  const [targetPhone, setTargetPhone] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Default target phone to the last received message
  useEffect(() => {
    const lastReceived = [...messages].reverse().find(m => !m.isMine);
    if (lastReceived && !targetPhone) {
      setTargetPhone(lastReceived.from.split('@')[0]);
    }
  }, [messages]);

  const handleReplyClick = (from) => {
    setTargetPhone(from.split('@')[0]);
    // Focus the input? (optional)
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText || !targetPhone) return;

    setSending(true);
    try {
      const res = await fetch(`${apiUrl}/send-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: targetPhone, message: replyText }),
      });
      const data = await res.json();
      if (data.success) {
        setReplyText('');
      }
    } catch (err) {
      console.error('Reply error:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.chatCard}>
      <header className={styles.chatHeader}>
        <div className={styles.headerInfo}>
          <div className={styles.avatar}>💬</div>
          <div>
            <h2 className={styles.headerTitle}>Live Chat Feed</h2>
            <span className={styles.headerSubtitle}>
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <button className={styles.refreshBtn} onClick={onRefresh}>
          <span className={styles.refreshIcon}>🔄</span>
        </button>
      </header>

      <div className={styles.chatBody} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>💬</div>
            <h3>Waiting for messages...</h3>
            <p>Scanning for incoming activity from Evolution API</p>
          </div>
        ) : (
          <div className={styles.messageList}>
            {messages.map((msg, i) => (
              <MessageItem key={msg.id || i} msg={msg} onReply={handleReplyClick} />
            ))}
          </div>
        )}
      </div>

      <footer className={styles.chatFooter}>
        <form onSubmit={handleSendReply} className={styles.replyForm}>
          <div className={styles.replyInputWrapper}>
            <div className={styles.targetLabel}>
              Replying to: <strong>{targetPhone || 'None'}</strong>
            </div>
            <div className={styles.inputRow}>
              <input
                type="text"
                className={styles.replyInput}
                placeholder="Type your message..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={sending}
              />
              <button type="submit" className={styles.sendBtn} disabled={sending || !replyText || !targetPhone}>
                {sending ? '...' : '➤'}
              </button>
            </div>
          </div>
        </form>
      </footer>
    </div>
  );
}
