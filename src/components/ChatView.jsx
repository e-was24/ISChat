import React, { useState, useEffect, useRef } from 'react';
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
  DoubleCheckIcon,
  TrashIcon
} from './Icons';
import { db } from '../utils/db';
import { supabase } from '../supabase';

const ChatView = () => {
  const [message, setMessage] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mobileView, setMobileView] = useState('messages');
  const [newContact, setNewContact] = useState('');
  
  const [myProfile, setMyProfile] = useState({ name: '', uniqueId: '', status: '' });
  const [contacts, setContacts] = useState([]);
  const [activeContactId, setActiveContactId] = useState('');
  const [messages, setMessages] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const messagesEndRef = useRef(null);

  const versionHistory = [
    { v: '1.3.3', detail: 'Persistent Deletion, Real Read Status, & Scroll Fix.' },
    { v: '1.3.2', detail: 'Real-Time Supabase, Deletion (Contact/Msg), & Mobile Tweak.' },
    { v: '1.3.1', detail: 'Message Status Indicators (Checkmarks) & Supabase Ready.' }
  ];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load initial data
  useEffect(() => {
    const profile = db.getProfile();
    const savedContacts = db.getContacts();
    const savedDeletedIds = db.getDeletedMessages();
    setMyProfile(profile);
    setContacts(savedContacts);
    setDeletedIds(savedDeletedIds);
    if (savedContacts.length > 0) setActiveContactId(savedContacts[0].id);
  }, []);

  // Sync data to local DB
  useEffect(() => {
    if (contacts.length > 0) db.saveContacts(contacts);
  }, [contacts]);

  useEffect(() => {
    db.saveDeletedMessages(deletedIds);
  }, [deletedIds]);

  // SUPABASE REAL-TIME Logic
  useEffect(() => {
    if (!myProfile.uniqueId) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${myProfile.uniqueId},receiver_id.eq.${myProfile.uniqueId}`)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new;
          if (newMsg.receiver_id === myProfile.uniqueId || newMsg.sender_id === myProfile.uniqueId) {
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            // Auto mark as read if active
            if (newMsg.receiver_id === myProfile.uniqueId && newMsg.sender_id === activeContactId) {
              markAsRead(newMsg.id);
            }
          }
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myProfile.uniqueId, activeContactId]);

  const markAsRead = async (messageId) => {
    await supabase.from('messages').update({ status: 'read' }).eq('id', messageId);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !activeContactId) return;
    
    const newMsg = { 
      text: message, 
      sender_id: myProfile.uniqueId, 
      receiver_id: activeContactId, 
      status: 'sent',
      created_at: new Date().toISOString()
    };
    
    setMessage('');
    
    const { error } = await supabase.from('messages').insert([newMsg]);
    if (error) {
      console.error('Error sending message:', error);
      alert('Gagal mengirim pesan.');
    }
  };

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!newContact.trim()) return;
    const formatted = newContact.startsWith('+') ? newContact : `+${newContact}`;
    if (contacts.find(c => c.id === formatted)) return alert('Kontak sudah ada.');
    setContacts(prev => [...prev, { id: formatted, name: formatted, status: 'Baru ditambahkan', avatar: '?' }]);
    setNewContact('');
  };

  const handleDeleteContact = (id) => {
    if (window.confirm('Hapus kontak ini?')) {
      setContacts(prev => prev.filter(c => c.id !== id));
      if (activeContactId === id) setActiveContactId('');
    }
  };

  const handleDeleteForMe = (id) => {
    setDeletedIds(prev => [...prev, id]);
  };

  const handleDeleteForEveryone = async (id) => {
    if (window.confirm('Hapus pesan ini untuk semua orang?')) {
      const { error } = await supabase.from('messages').delete().eq('id', id);
      if (error) alert('Gagal menghapus pesan.');
    }
  };

  const activeContact = contacts.find(c => c.id === activeContactId) || { avatar: '?', name: 'Pilih Kontak' };
  
  // Filter messages: matches current chat AND NOT deleted for me
  const getDisplayMessages = () => {
    return messages.filter(m => 
      !deletedIds.includes(m.id) &&
      ((m.sender_id === myProfile.uniqueId && m.receiver_id === activeContactId) ||
      (m.sender_id === activeContactId && m.receiver_id === myProfile.uniqueId))
    );
  };

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
              <button className="delete-contact-btn" onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.id); }}>
                <TrashIcon className="sidebar-icon" />
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="version-btn" onClick={() => setShowVersionModal(true)}>
            <InfoIcon className="sidebar-icon" /> <span>v1.3.3</span>
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
          {activeContactId ? (
            getDisplayMessages().length > 0 ? (
              getDisplayMessages().map((msg) => (
                <div key={msg.id} className={`message-wrapper ${msg.sender_id === myProfile.uniqueId ? 'user' : 'bot'}`}>
                  <div className="message-bubble">
                    <div className="message-content">{msg.text}</div>
                    <div className="message-meta">
                      <span className="timestamp">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.sender_id === myProfile.uniqueId && (
                        <span className={`status-icon ${msg.status}`}>
                          {msg.status === 'sent' && <SingleCheckIcon className="check-svg" />}
                          {msg.status === 'delivered' && <DoubleCheckIcon className="check-svg" />}
                          {msg.status === 'read' && <DoubleCheckIcon className="check-svg read" />}
                        </span>
                      )}
                    </div>
                    <div className="message-actions">
                      <button className="action-btn" onClick={() => handleDeleteForMe(msg.id)}>Hapus Saya</button>
                      {msg.sender_id === myProfile.uniqueId && (
                        <button className="action-btn delete" onClick={() => handleDeleteForEveryone(msg.id)}>Hapus Semua</button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-chat"><p>Belum ada pesan. Mulai obrolan.</p></div>
            )
          ) : (
            <div className="empty-chat"><p>Pilih kontak untuk chat.</p></div>
          )}
          <div ref={messagesEndRef} />
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
              <p className="note">Gunakan nomor ini untuk chat real-time via Supabase.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowProfileModal(false)}>Kembali</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;
