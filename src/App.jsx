import { useState, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { LogoIcon, RocketIcon, DownloadTrayIcon } from './components/Icons'
import ChatView from './components/ChatView'
import './index.css'

function App() {
  const [hasStarted, setHasStarted] = useState(false)
  
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered')
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  useEffect(() => {
    // Detect if app is running in standalone mode (installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      setHasStarted(true);
    }
  }, []);

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (hasStarted) {
    return <ChatView />;
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
        <button className="btn btn-primary" onClick={() => setHasStarted(true)}>
          <RocketIcon className="btn-icon-svg" /> Mulai Sekarang
        </button>
        <button className="btn btn-secondary" onClick={() => alert('Gunakan menu browser atau klik ikon download di address bar untuk install!')}>
          <DownloadTrayIcon className="btn-icon-svg" /> Install App
        </button>
      </div>

      {(offlineReady || needRefresh) && (
        <div className="reload-toast">
          <div className="message">
            {offlineReady ? (
              <span>Aplikasi siap di-install & akses cepat aktif! 🚀</span>
            ) : (
              <span>Fitur baru tersedia, segera update! ⚡</span>
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
