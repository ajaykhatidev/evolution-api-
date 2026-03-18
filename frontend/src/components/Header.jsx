import styles from './Header.module.css'

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.logo}>
          <span className={styles.icon}>💬</span>
          <div>
            <h1 className={styles.title}>WhatsApp CRM</h1>
            <p className={styles.subtitle}>Evolution API Integration</p>
          </div>
        </div>
      </div>
    </header>
  )
}
