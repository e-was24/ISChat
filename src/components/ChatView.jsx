import React, { useState, useEffect } from 'react';
import { 
  SendIcon, 
  SearchIcon, 
  LogoIcon, 
  SettingsIcon, 
  InfoIcon, 
  UserPlusIcon, 
  UserIcon, 
  MessageSquareIcon, 
  UsersIcon,
  SingleCheckIcon,
  DoubleCheckIcon
} from './Icons';
import { db } from '../utils/db';

const ChatView = () => {
  const [message, setMessage] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mobileView, setMobileView] = useState('messages');
  const [newContact, setNewContact] = useState('');
  
  const [myProfile, setMyProfile] = useState({ name: '', uniqueId: '', status: '' });
  const [contacts, setContacts] = useState([]);
  const [activeContactId, setActiveContactId] = useState('ai-init');
  const [messages, setMessages] = useState([]);

  const versionHistory = [
    { v: '1.3.1', detail: 'Message Status Indicators (Checkmarks) & Supabase Ready.' },
    { v: '1.3.0', detail: 'Data Persistence (DB), Fix Send Icon, & Unique User Numbers.' },
    { v: '1.2.0', detail: 'Fitur Profil, Nomor Unik, & Bottom Navigation (Mobile).' }
  ];

  useEffect(() => {
    const profile = db.getProfile();
    const savedContacts = db.getContacts();
    const savedMessages = db.getMessages();
    setMyProfile(profile);
    setContacts(savedContacts);
    setMessages(savedMessages);
    if (savedContacts.length > 0) setActiveContactId(savedContacts[0].id);
  }, []);

  useEffect(() => {
    if (contacts.length > 0) db.saveContacts(contacts);
  }, [contacts]);

  useEffect(() => {
    if (messages.length > 0) db.saveMessages(messages);
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const msgId = Date.now();
    const newMsg = { 
      id: msgId, 
      text: message, 
      sender: 'user', 
      contactId: activeContactId, 
      status: 'sent', // 'sent', 'delivered', 'read'
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setMessages(prev => [...prev, newMsg]);
    setMessage('');
    
    // Simulate status progression
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'delivered' } : m));
    }, 1000);

    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'read' } : m));
    }, 3000);

    // Simulated Bot Response
    if (activeContactId === 'ai-init') {
      setTimeout(() => {
        const botMsg = { 
          id: Date.now() + 1, 
          text: 'Pesan Anda sudah saya terima! Kami akan segera kembali.', 
          sender: 'bot', 
          contactId: activeContactId, 
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
        };
        setMessages(prev => [...prev, botMsg]);
      }, 4000);
    }
  };

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!newContact.trim()) return;
    const id = Date.now().toString();
    const formattedName = newContact.startsWith('+') ? newContact : `+${newContact}`;
    setContacts(prev => [...prev, { id, name: formattedName, status: 'Baru ditambahkan', avatar: '?' }]);
    setNewContact('');
    alert(`Nomor ${formattedName} berhasil disimpan!`);
  };

  const activeContact = contacts.find(c => c.id === activeContactId) || contacts[0] || { avatar: '?', name: 'Unknown' };
  const activeMessages = messages.filter(m => m.contactId === activeContactId);

  return (
    <div className="chat-container">
      <aside className={`chat-sidebar ${mobileView === 'contacts' ? 'mobile-active' : ''}`}>
        <div className="sidebar-header">
          <LogoIcon className="sidebar-logo" />
          <h2>ISChat</h2>
          <button className="profile-trigger" onClick={() => setShowProfileModal(true)}>
            <UserIcon className="sidebar-icon" />
          </button>
        </div>
        
        <form className="add-contact-bar" onSubmit={handleAddContact}>
          <div className="input-group">
            <UserPlusIcon className="input-icon" />
            <input type="text" placeholder="Tambah nomor..." value={newContact} onChange={(e) => setNewContact(e.target.value)} />
            <button type="submit" className="add-btn">Add</button>
          </div>
        </form>

        <div className="search-bar">
          <SearchIcon className="search-icon" />
          <input type="text" placeholder="Cari kontak..." />
        </div>
        
        <div className="contact-list">
          {contacts.map((contact) => (
            <div key={contact.id} className={`contact-item ${activeContactId === contact.id ? 'active' : ''}`} onClick={() => { setActiveContactId(contact.id); if (window.innerWidth <= 768) setMobileView('messages'); }}>
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
            <InfoIcon className="sidebar-icon" /> <span>v1.3.1</span>
          </button>
          <button className="settings-btn"> <SettingsIcon className="sidebar-icon" /> </button>
        </div>
      </aside>

      <main className={`chat-main ${mobileView === 'messages' ? 'mobile-active' : ''}`}>
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
                  <div className="message-content">{msg.text}</div>
                  <div className="message-meta">
                    <span className="timestamp">{msg.timestamp}</span>
                    {msg.sender === 'user' && (
                      <span className={`status-icon ${msg.status}`}>
                        {msg.status === 'sent' && <SingleCheckIcon className="check-svg" />}
                        {(msg.status === 'delivered' || msg.status === 'read') && <DoubleCheckIcon className="check-svg" />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-chat"><p>Belum ada pesan. Mulai obrolan dengan {activeContact.name}</p></div>
          )}
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
          <input type="text" placeholder="Ketik pesan..." value={message} onChange={(e) => setMessage(e.target.value)} />
          <button type="submit" className="send-btn"> <SendIcon className="btn-icon-svg" /> </button>
        </form>
      </main>

      <nav className="mobile-bottom-nav">
        <button className={`nav-item ${mobileView === 'contacts' ? 'active' : ''}`} onClick={() => setMobileView('contacts')}>
          <UsersIcon className="nav-icon" /> <span>Kontak</span>
        </button>
        <button className={`nav-item ${mobileView === 'messages' ? 'active' : ''}`} onClick={() => setMobileView('messages')}>
          <MessageSquareIcon className="nav-icon" /> <span>Pesan</span>
        </button>
        <button className="nav-item" onClick={() => setShowProfileModal(true)}>
          <UserIcon className="nav-icon" /> <span>Profil</span>
        </button>
      </nav>

      {showVersionModal && (
        <div className="modal-overlay" onClick={() => setShowVersionModal(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <h3>Update History</h3>
            <div className="version-list">
              {versionHistory.map(item => (
                <div key={item.v} className="version-item"><span className="v-tag">{item.v}</span><p>{item.detail}</p></div>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => setShowVersionModal(false)}>Tutup</button>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal-content glass-card profile-modal" onClick={e => e.stopPropagation()}>
            <div className="profile-header">
              <div className="avatar-large">{myProfile.name ? myProfile.name.charAt(0) : 'P'}</div>
              <h3>{myProfile.name}</h3>
              <p>{myProfile.status}</p>
            </div>
            <div className="unique-id-box">
              <label>Nomor Unik Anda</label>
              <div className="id-card">
                <span className="id-number">{myProfile.uniqueId}</span>
                <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(myProfile.uniqueId); alert('Nomor disalin!'); }}>Salin</button>
              </div>
              <p className="note">Bagikan nomor ini agar orang lain bisa menyimpan Anda sebagai kontak.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowProfileModal(false)}>Kembali</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;
