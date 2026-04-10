import { useRegisterSW } from 'virtual:pwa-register/react'
import { LogoIcon, InstallIcon, CloudIcon, PerformanceIcon, RocketIcon, DownloadTrayIcon } from './components/Icons'
import './index.css'

function App() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  return (
    <div className="glass-card">
      <div className="logo-container">
        <LogoIcon className="app-logo-svg" />
      </div>

      <h1>ISChat</h1>
      <p className="tagline">
        Pengalaman chat modern dengan performa tinggi. Dapat diakses via web atau di-install langsung ke perangkat Anda.
      </p>

      <div className="cta-group">
        <button className="btn btn-primary" onClick={() => window.open('#', '_self')}>
          <RocketIcon className="btn-icon-svg" /> Mulai Sekarang
        </button>
        <button className="btn btn-secondary" onClick={() => alert('Gunakan menu browser atau klik ikon download di address bar untuk install!')}>
          <DownloadTrayIcon className="btn-icon-svg" /> Install App
        </button>
      </div>

      <div className="features-grid">
        <div className="feature-item">
          <InstallIcon className="feature-svg" />
          <h3>Installable</h3>
          <p>Download aplikasi langsung dari browser ke home screen Anda tanpa melalui App Store.</p>
        </div>
        <div className="feature-item">
          <CloudIcon className="feature-svg" />
          <h3>Cloud Sync</h3>
          <p>Data tersinkronisasi secara real-time di semua perangkat yang Anda gunakan.</p>
        </div>
        <div className="feature-item">
          <PerformanceIcon className="feature-svg" />
          <h3>Performa Cepat</h3>
          <p>Gunakan teknologi PWA untuk loading secepat kilat bahkan dengan koneksi lambat.</p>
        </div>
      </div>

      {(offlineReady || needRefresh) && (
        <div className="reload-toast">
          <div className="message">
            {offlineReady ? (
              <span>Aplikasi siap digunakan secara offline!</span>
            ) : (
              <span>Konten baru tersedia, klik tombol untuk update.</span>
            )}
          </div>
          {needRefresh && (
            <button className="btn btn-primary" onClick={() => updateServiceWorker(true)}>
              Update
            </button>
          )}
          <button className="btn btn-secondary" onClick={() => close()}>
            Tutup
          </button>
        </div>
      )}
    </div>
  )
}

export default App
