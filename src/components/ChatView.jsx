import React, { useState } from 'react';
import { SendIcon, SearchIcon, LogoIcon } from './Icons';

const ChatView = () => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: 'Halo! Selamat datang di ISChat. Ada yang bisa kami bantu?', sender: 'bot' },
    { id: 2, text: 'Ini adalah tampilan premium chat kami.', sender: 'bot' }
  ]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setMessages([...messages, { id: Date.now(), text: message, sender: 'user' }]);
    setMessage('');
    
    // Simple auto-reply simulation
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
    </div>
  );
};

export default ChatView;
