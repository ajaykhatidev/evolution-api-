import { useState } from 'react';
import styles from './Sidebar.module.css';

const Sidebar = ({ apiUrl, status, qrCode }) => {
  const [loading, setLoading] = useState(false);

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
      
      if (data.error && data.error.includes('not found')) {
        await createInstance();
      }
      // Note: Actual QR image/code is handled via socket in App.jsx
    } catch (err) {
      console.error('Error generating QR:', err);
    } finally {
      setLoading(false);
    }
  };

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
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Generate New QR'}
            </button>
            {qrCode && (
              <div className={styles.qrContainer}>
                <p>Scan this QR to connect:</p>
                <img src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" />
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
