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
import { formatPhoneInput, canonicalPhone, cleanPhone } from '../utils/format';

const ChatView = () => {
  const [message, setMessage] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mobileView, setMobileView] = useState('contacts'); // Default to contacts
  const [newContact, setNewContact] = useState('');
  
  const [myProfile, setMyProfile] = useState({ name: '', uniqueId: '', status: '' });
  const [contacts, setContacts] = useState([]);
  const [activeContactId, setActiveContactId] = useState('');
  const [messages, setMessages] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [lastPayload, setLastPayload] = useState(null); // Diagnostic
  const messagesEndRef = useRef(null);

  const versionHistory = [
    { v: '1.4.3', detail: 'Live Diagnostics Overlay & Connection Check.' },
    { v: '1.4.2', detail: 'Final Stable: Production Cleanup.' },
    { v: '1.4.1', detail: 'Zero-Format Dependency Sync (Robust IDs).' }
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
    
    // Canonicalize existing contacts on load
    const sanitizedContacts = savedContacts.map(c => ({
      ...c,
      id: canonicalPhone(c.id) // Ensure ID is canonical (+62812...)
    }));

    setMyProfile(profile);
    setContacts(sanitizedContacts);
    setDeletedIds(savedDeletedIds);
    if (sanitizedContacts.length > 0) setActiveContactId(sanitizedContacts[0].id);
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
        setLastPayload(payload); // Store for UI diagnostic
        if (payload.eventType === 'INSERT') {
          const newMsg = payload.new;
          
          const myCleanId = cleanPhone(myProfile.uniqueId);
          const rxCleanId = cleanPhone(newMsg.receiver_id || '');
          const txCleanId = cleanPhone(newMsg.sender_id || '');
          const activeCleanId = cleanPhone(activeContactId);

          const isForMe = rxCleanId === myCleanId;
          const isFromMe = txCleanId === myCleanId;
          
          if (isForMe || isFromMe) {
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            if (isForMe && txCleanId === activeCleanId) {
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

  // Bulk mark as read when chat is active
  useEffect(() => {
    if (!myProfile.uniqueId || !activeContactId || messages.length === 0) return;

    const unreadIds = messages
      .filter(m => m.receiver_id === myProfile.uniqueId && m.sender_id === activeContactId && m.status !== 'read')
      .map(m => m.id);

    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  }, [activeContactId, messages, myProfile.uniqueId]);

  const markAsRead = async (ids) => {
    const idList = Array.isArray(ids) ? ids : [ids];
    if (idList.length === 0) return;
    await supabase.from('messages').update({ status: 'read' }).in('id', idList);
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
    
    const tempText = message;
    setMessage('');
    
    const { error } = await supabase.from('messages').insert([newMsg]);
    if (error) {
      console.error('Error sending message:', error);
      setMessage(tempText); // Restore on error
      alert(`Gagal mengirim pesan: ${error.message}\n\nPastikan Tabel 'messages' sudah dibuat di Supabase.`);
    }
  };

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!newContact.trim()) return;
    
    const canonical = canonicalPhone(newContact);
    if (contacts.find(c => c.id === canonical)) return alert('Kontak sudah ada.');
    
    setContacts(prev => [...prev, { 
      id: canonical, 
      name: canonical, // Display formatted version via helper in JSX
      status: 'Baru ditambahkan', 
      avatar: '?' 
    }]);
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

  const activeContact = contacts.find(c => c.id === activeContactId) || { avatar: '?', id: '' };
  
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
            <input 
              type="text" 
              placeholder="Tambah nomor (contoh 0812...)" 
              value={newContact} 
              onChange={(e) => setNewContact(formatPhoneInput(e.target.value))} 
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
            <div key={contact.id} className={`contact-item ${activeContactId === contact.id ? 'active' : ''}`} onClick={() => { setActiveContactId(contact.id); if (window.innerWidth <= 768) setMobileView('messages'); }}>
              <div className="avatar">{contact.avatar}</div>
              <div className="contact-info">
                <h4>{formatPhoneInput(contact.id)}</h4>
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
            <InfoIcon className="sidebar-icon" /> <span>v1.4.3</span>
          </button>
          <button className="settings-btn"> <SettingsIcon className="sidebar-icon" /> </button>
        </div>
      </aside>

      <main className={`chat-main ${mobileView === 'messages' ? 'mobile-active' : ''}`}>
        <header className="chat-header">
          <div className="active-contact">
            {activeContactId ? (
              <>
                <div className="avatar">{activeContact.avatar}</div>
                <div className="header-info">
                  <h3>{formatPhoneInput(activeContact.id)}</h3>
                  <p className="status-indicator">{activeContact.status}</p>
                </div>
              </>
            ) : (
              <div className="header-info"><h3>Pilih Kontak</h3></div>
            )}
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
              <p>{myProfile.status} | ID: {cleanPhone(myProfile.uniqueId)}</p>
            </div>
            <div className="unique-id-box">
              <label>Nomor Unik Anda</label>
              <div className="id-card">
                <span className="id-number">{formatPhoneInput(myProfile.uniqueId)}</span>
                <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(formatPhoneInput(myProfile.uniqueId)); alert('Nomor disalin!'); }}>Salin</button>
              </div>
              <p className="note">Gunakan nomor ini untuk chat real-time via Supabase.</p>
            </div>
            
            <div className="diag-box">
              <p>Diagnostic v1.4.3:</p>
              <code>Last Event: {lastPayload ? lastPayload.eventType : 'None'}</code>
              {lastPayload && lastPayload.new && (
                <code>Rx: {cleanPhone(lastPayload.new.receiver_id)} | Tx: {cleanPhone(lastPayload.new.sender_id)}</code>
              )}
            </div>

            <button className="btn btn-primary" onClick={() => setShowProfileModal(false)}>Kembali</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;
