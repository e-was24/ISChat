import React, { useState } from 'react';
import { SendIcon, SearchIcon, LogoIcon, SettingsIcon, InfoIcon, UserPlusIcon } from './Icons';

const ChatView = () => {
  const [message, setMessage] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [newContact, setNewContact] = useState('');
  const [contacts, setContacts] = useState([
    { id: 'ai-init', name: 'Support Assistant', status: 'Online', avatar: 'AI' }
  ]);
  const [activeContactId, setActiveContactId] = useState('ai-init');
  
  const [messages, setMessages] = useState([
    { id: 1, text: 'Halo! Selamat datang di ISChat v1.1.0. Ada yang bisa kami bantu?', sender: 'bot', contactId: 'ai-init' },
    { id: 2, text: 'Ini adalah tampilan premium chat kami.', sender: 'bot', contactId: 'ai-init' }
  ]);

  const versionHistory = [
    { v: '1.1.1', detail: 'Fitur Tambah Kontak & Manajemen Nomor.' },
    { v: '1.1.0', detail: 'Implementasi Versi, History Update, & Chat Interface.' },
    { v: '1.0.2', detail: 'PWA Navigation & Standalone Detection.' }
  ];

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setMessages([...messages, { id: Date.now(), text: message, sender: 'user', contactId: activeContactId }]);
    setMessage('');
    
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, text: 'Sangat baik! Ada lagi yang ingin Anda tanyakan?', sender: 'bot', contactId: activeContactId }]);
    }, 1000);
  };

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!newContact.trim()) return;
    
    const id = Date.now().toString();
    const formattedName = newContact.startsWith('+') ? newContact : `+${newContact}`;
    
    setContacts([...contacts, { 
      id: id, 
      name: formattedName, 
      status: 'Baru ditambahkan',
      avatar: '?'
    }]);
    setNewContact('');
    alert(`Nomor ${formattedName} berhasil disimpan!`);
  };

  const activeContact = contacts.find(c => c.id === activeContactId) || contacts[0];
  const activeMessages = messages.filter(m => m.contactId === activeContactId);

  return (
    <div className="chat-container">
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <LogoIcon className="sidebar-logo" />
          <h2>ISChat</h2>
        </div>
        
        <form className="add-contact-bar" onSubmit={handleAddContact}>
          <div className="input-group">
            <UserPlusIcon className="input-icon" />
            <input 
              type="text" 
              placeholder="Tambah nomor (ex: 628...)" 
              value={newContact}
              onChange={(e) => setNewContact(e.target.value)}
            />
            <button type="submit" className="add-btn">Add</button>
          </div>
        </form>

        <div className="search-bar">
          <SearchIcon className="search-icon" />
          <input type="text" placeholder="Cari kontak..." />
        </div>
        
        <div className="contact-list">
          {contacts.map((contact) => (
            <div 
              key={contact.id} 
              className={`contact-item ${activeContactId === contact.id ? 'active' : ''}`}
              onClick={() => setActiveContactId(contact.id)}
            >
              <div className="avatar">{contact.avatar}</div>
              <div className="contact-info">
                <h4>{contact.name}</h4>
                <p>{contact.status}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="version-btn" onClick={() => setShowVersionModal(true)}>
            <InfoIcon className="sidebar-icon" />
            <span>v1.1.1</span>
          </button>
          <button className="settings-btn">
            <SettingsIcon className="sidebar-icon" />
          </button>
        </div>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div className="active-contact">
            <div className="avatar">{activeContact.avatar}</div>
            <div className="header-info">
              <h3>{activeContact.name}</h3>
              <p className="status-indicator">{activeContact.status}</p>
            </div>
          </div>
        </header>

        <div className="messages-area">
          {activeMessages.length > 0 ? (
            activeMessages.map((msg) => (
              <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
                <div className="message-bubble">
                  {msg.text}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-chat">
              <p>Belum ada pesan. Mulai obrolan dengan {activeContact.name}</p>
            </div>
          )}
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
