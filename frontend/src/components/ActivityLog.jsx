import { useEffect, useRef, useState } from 'react';
import styles from './ActivityLog.module.css';

function MessageItem({ msg, onSelect }) {
  const isSent = msg.isMine;
  const senderLabel = msg.contact || msg.from;
  const sentLabel = msg.contact || msg.to;
  
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
      <div
        className={`${styles.bubble} ${isSent ? styles.sentBubble : styles.receivedBubble}`}
        onClick={() => onSelect(msg)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSelect(msg);
        }}
        title="Click to reply to this contact"
      >
        {!isSent && (
          <div className={styles.bubbleHeader}>
            <div className={styles.sender}>{msg.pushName || msg.from}</div>
            <button className={styles.replyMiniBtn} onClick={() => onSelect(msg)} title="Reply">
              ↩️
            </button>
          </div>
        )}
        {isSent && sentLabel && (
          <div className={styles.bubbleHeader}>
            <div className={styles.sender}>To: {sentLabel}</div>
            <button className={styles.replyMiniBtn} onClick={() => onSelect(msg)} title="Reply">
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

export default function ActivityLog({ messages, onRefresh, apiUrl, activeContact, activeName }) {
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
    if (activeContact) {
      setTargetPhone(activeContact);
    }
  }, [activeContact]);

  const handleSelectMessage = (msg) => {
    const raw = msg.isMine ? msg.to : msg.from;
    // VERY IMPORTANT: Keep @lid and @g.us for non-standard IDs to avoid @s.whatsapp.net fallback
    if (raw) setTargetPhone((raw.includes('@lid') || raw.includes('@g.us')) ? raw : raw.split('@')[0]);
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
            <h2 className={styles.headerTitle}>{activeName || activeContact || 'Select a chat'}</h2>
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
            <h3>{activeContact ? 'No messages yet' : 'Select a client from the left'}</h3>
            <p>{activeContact ? 'Start a conversation below.' : 'Choose a chat to manage messages.'}</p>
          </div>
        ) : (
          <div className={styles.messageList}>
            {messages.map((msg, i) => (
              <MessageItem key={msg.id || i} msg={msg} onSelect={handleSelectMessage} />
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
