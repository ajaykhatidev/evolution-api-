import { useState } from 'react';
import styles from './Sidebar.module.css';

const Sidebar = ({ apiUrl, status, qrCode, compact = false }) => {
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startTimer = () => {
    setCountdown(10);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const createInstance = async () => {
    setLoading(true);
    try {
      await fetch(`${apiUrl}/create-instance`, { method: 'POST' });
      // The QR will come via Socket if the webhook is configured
    } catch (err) {
      console.error('Error creating instance:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateQR = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/qr`);
      const data = await res.json();
      
      if (res.status === 404 || (data.error && typeof data.error === 'string' && data.error.includes('not found'))) {
        startTimer();
        await createInstance();
      }
      // Note: Actual QR image/code is handled via socket in App.jsx
    } catch (err) {
      console.error('Error generating QR:', err);
    } finally {
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div className={styles.compact}>
        <div className={`${styles.statusIndicator} ${styles[status]}`}>
          {status ? status.toUpperCase() : 'UNKNOWN'}
        </div>
        {status !== 'open' && (
          <button 
            className={styles.compactBtn} 
            onClick={generateQR}
            disabled={loading || countdown > 0}
          >
            {loading ? '...' : countdown > 0 ? `${countdown}s` : 'QR'}
          </button>
        )}
        {qrCode && (
          <img
            className={styles.compactQr}
            src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`}
            alt="WhatsApp QR Code"
          />
        )}
      </div>
    );
  }

  return (
    <div className={styles.sidebar}>
      <div className={styles.statusSection}>
        <h3>WhatsApp Instance</h3>
        <div className={`${styles.statusIndicator} ${styles[status]}`}>
          {status ? status.toUpperCase() : 'UNKNOWN'}
        </div>
      </div>

      <div className={styles.qrSection}>
        {status !== 'open' ? (
          <>
            <button 
              className={styles.qrButton} 
              onClick={generateQR}
              disabled={loading || countdown > 0}
            >
              {loading ? 'Processing...' : countdown > 0 ? `Wait ${countdown}s...` : 'Generate New QR'}
            </button>
            {qrCode && (
              <div className={styles.qrContainer}>
                <p>Scan this QR to connect:</p>
                <img src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" />
                <a 
                  href={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`} 
                  download="whatsapp-qr.png" 
                  className={styles.downloadBtn}
                >
                  📥 Download QR
                </a>
                <small className={styles.socketHint}>Waiting for scan...</small>
              </div>
            )}
            {!qrCode && !loading && status !== 'open' && (
              <p className={styles.hint}>Click the button above to start connection</p>
            )}
          </>
        ) : (
          <div className={styles.connectedMsg}>
            <div className={styles.checkIcon}>✅</div>
            <p><strong>Instance Connected!</strong></p>
            <p className={styles.small}>You can now send and receive messages in real-time.</p>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <p>Evolution API v2.0</p>
        <p className={styles.socketStatus}>Socket: Active</p>
      </div>
    </div>
  );
};

export default Sidebar;
