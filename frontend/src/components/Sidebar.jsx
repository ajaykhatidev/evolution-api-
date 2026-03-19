import { useState, useEffect } from 'react';
import styles from './Sidebar.module.css';

const Sidebar = ({ apiUrl }) => {
  const [status, setStatus] = useState('disconnected');
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${apiUrl}/status`);
      const data = await res.json();
      if (data.instance?.state) {
        setStatus(data.instance.state);
      }
    } catch (err) {
      console.error('Error fetching status:', err);
    }
  };

  const createInstance = async () => {
    setLoading(true);
    try {
      await fetch(`${apiUrl}/create-instance`, { method: 'POST' });
      await getQR();
    } catch (err) {
      console.error('Error creating instance:', err);
    } finally {
      setLoading(false);
    }
  };

  const getQR = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/qr`);
      const data = await res.json();
      if (data.code) {
        setQrCode(data.code);
      } else if (data.base64) {
        setQrCode(data.base64);
      } else if (data.error && data.error.includes('not found')) {
        // If not found, try creating it first
        await createInstance();
      }
    } catch (err) {
      console.error('Error fetching QR:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // Check status every 10s
    return () => clearInterval(interval);
  }, [apiUrl]);

  return (
    <div className={styles.sidebar}>
      <div className={styles.statusSection}>
        <h3>WhatsApp Instance</h3>
        <div className={`${styles.statusIndicator} ${styles[status]}`}>
          {status.toUpperCase()}
        </div>
      </div>

      <div className={styles.qrSection}>
        {status !== 'open' ? (
          <>
            <button 
              className={styles.qrButton} 
              onClick={getQR}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate New QR'}
            </button>
            {qrCode && (
              <div className={styles.qrContainer}>
                <p>Scan this QR to connect:</p>
                <img src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`} alt="WhatsApp QR Code" />
              </div>
            )}
          </>
        ) : (
          <div className={styles.connectedMsg}>
            <p>✅ Everything is ready. You can now send and receive messages.</p>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <p>Evolution API v2.0</p>
      </div>
    </div>
  );
};

export default Sidebar;
