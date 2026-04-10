import React, { useState } from 'react';
import { SendIcon, SearchIcon, LogoIcon, SettingsIcon, InfoIcon } from './Icons';

const ChatView = () => {
  const [message, setMessage] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: 'Halo! Selamat datang di ISChat v1.1.0. Ada yang bisa kami bantu?', sender: 'bot' },
    { id: 2, text: 'Ini adalah tampilan premium chat kami.', sender: 'bot' }
  ]);

  const versionHistory = [
    { v: '1.1.0', detail: 'Implementasi Versi, History Update, & Chat Interface.' },
    { v: '1.0.2', detail: 'PWA Navigation & Standalone Detection.' },
    { v: '1.0.1', detail: 'Responsive UI & Premium SVG Icons.' }
  ];

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setMessages([...messages, { id: Date.now(), text: message, sender: 'user' }]);
    setMessage('');
    
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, text: 'Pesan Anda telah diterima! 🚀', sender: 'bot' }]);
    }, 1000);
  };

  return (
    <div className="chat-container">
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <LogoIcon className="sidebar-logo" />
          <h2>ISChat</h2>
        </div>
        
        <div className="search-bar">
          <SearchIcon className="search-icon" />
          <input type="text" placeholder="Cari pesan..." />
        </div>
        
        <div className="contact-list">
          <div className="contact-item active">
            <div className="avatar">AI</div>
            <div className="contact-info">
              <h4>Support Assistant</h4>
              <p>Online</p>
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <button className="version-btn" onClick={() => setShowVersionModal(true)}>
            <InfoIcon className="sidebar-icon" />
            <span>v1.1.0</span>
          </button>
          <button className="settings-btn">
            <SettingsIcon className="sidebar-icon" />
          </button>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div className="active-contact">
            <div className="avatar">AI</div>
            <h3>Support Assistant</h3>
          </div>
        </header>

        <div className="messages-area">
          {messages.map((msg) => (
            <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
              <div className="message-bubble">
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
          <input 
            type="text" 
            placeholder="Ketik pesan di sini..." 
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit" className="send-btn">
            <SendIcon className="btn-icon-svg" />
          </button>
        </form>
      </main>

      {showVersionModal && (
        <div className="modal-overlay" onClick={() => setShowVersionModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <h3>Update History</h3>
            <div className="version-list">
              {versionHistory.map(item => (
                <div key={item.v} className="version-item">
                  <span className="v-tag">{item.v}</span>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => setShowVersionModal(false)}>Tutup</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;
