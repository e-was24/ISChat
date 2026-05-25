import React, { useState, useEffect, useRef } from "react";
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
  TrashIcon,
  EditIcon,
  CameraIcon,
} from "./Icons";
import { db } from "../utils/db";
import { supabase } from "../supabase";
import { formatPhoneInput, canonicalPhone, cleanPhone } from "../utils/format";

// === E2EE LOGIC ===
// Import fungsi crypto yang sudah kita buat sebelumnya
import {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
} from "../utils/crypto";

const ChatView = () => {
  const [message, setMessage] = useState("");
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mobileView, setMobileView] = useState("contacts");
  const [newContact, setNewContact] = useState("");
  const [editingContactId, setEditingContactId] = useState(null);
  const [editName, setEditName] = useState("");

  const [myProfile, setMyProfile] = useState({
    name: "",
    uniqueId: "",
    status: "",
    avatar: "",
  });
  const [contacts, setContacts] = useState([]);
  const [activeContactId, setActiveContactId] = useState("");
  const [messages, setMessages] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState({});

  // === E2EE LOGIC ===
  const [myPrivateKey, setMyPrivateKey] = useState("");
  const [activePublicKey, setActivePublicKey] = useState(""); // Menyimpan public key target chat
  const [decryptedMessages, setDecryptedMessages] = useState({}); // Menyimpan teks yang sudah didekripsi cache

  const messagesEndRef = useRef(null);
  const activeChatRef = useRef("");

  const versionHistory = [
    {
      v: "1.6.5",
      detail: "Security: End-to-End Encryption (E2EE) Implementation.",
    },
    {
      v: "1.6.4",
      detail: "Visibility: High-contrast Phone Numbers & UI Polish.",
    },
    {
      v: "1.6.3",
      detail: "Profile Sync: Shared Avatars via Presence & Pro Profile.",
    },
  ];

  const currentVersion = "1.6.5";

  // Force cache clear on version mismatch
  useEffect(() => {
    const savedVer = localStorage.getItem("ischat_app_version");
    if (savedVer && savedVer !== currentVersion) {
      localStorage.setItem("ischat_app_version", currentVersion);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (let registration of registrations) registration.unregister();
          window.location.reload(true);
        });
      } else {
        window.location.reload(true);
      }
    } else {
      localStorage.setItem("ischat_app_version", currentVersion);
    }
  }, []);

  useEffect(() => {
    activeChatRef.current = activeContactId;
  }, [activeContactId]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, decryptedMessages]);

  // Request Notification Permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Load initial
  useEffect(() => {
    const profile = db.getProfile();
    const savedContacts = db.getContacts();
    const savedIds = db.getDeletedMessages();

    const canonProfile = {
      ...profile,
      uniqueId: canonicalPhone(profile.uniqueId),
    };
    const canonContacts = savedContacts.map((c) => ({
      ...c,
      id: canonicalPhone(c.id),
    }));

    setMyProfile(canonProfile);
    setContacts(canonContacts);
    setDeletedIds(savedIds);
    setMessages(db.getMessages());
    if (canonContacts.length > 0) setActiveContactId(canonContacts[0].id);
  }, []);

  useEffect(() => {
    if (contacts.length > 0) db.saveContacts(contacts);
  }, [contacts]);
  useEffect(() => {
    db.saveDeletedMessages(deletedIds);
  }, [deletedIds]);
  useEffect(() => {
    db.saveProfile(myProfile);
  }, [myProfile]);
  useEffect(() => {
    db.saveMessages(messages);
  }, [messages]);

  // ====================================================================
  // 1. BLOK INISIALISASI KUNCI USER (Gunakan yang versi Auto-Repair ini)
  // ====================================================================
  useEffect(() => {
    const initE2EE = async () => {
      if (!myProfile.uniqueId) return;
      const myCanonId = canonicalPhone(myProfile.uniqueId);

      let privKey = localStorage.getItem("ischat_private_key");
      let pubKey = localStorage.getItem("ischat_public_key");

      // Jika di browser belum ada kunci, buat baru secara otomatis (Auto-Fix User Lama)
      if (!privKey || !pubKey) {
        console.log("Memicu auto-restart E2EE untuk nomor lama...");
        try {
          const keys = await generateKeyPair();
          privKey = keys.privateKey;
          pubKey = keys.publicKey;

          localStorage.setItem("ischat_private_key", privKey);
          localStorage.setItem("ischat_public_key", pubKey);
        } catch (cryptoError) {
          console.error("Gagal auto-generate key:", cryptoError);
          return;
        }
      }

      setMyPrivateKey(privKey);

      // Daftarkan atau perbarui key di database Supabase (Upsert)
      // Ini memastikan nomor lama otomatis masuk ke tabel user_keys tanpa mengubah nomornya
      await supabase.from("user_keys").upsert({
        phone_id: myCanonId,
        public_key: pubKey,
        updated_at: new Date().toISOString(),
      });

      console.log("Auto-sync E2EE sukses untuk nomor:", myCanonId);
    };

    initE2EE();
  }, [myProfile.uniqueId]);

  // ====================================================================
  // 2. BLOK MENGAMBIL KUNCI PENERIMA (Biarkan tetap seperti ini)
  // ====================================================================
  useEffect(() => {
    const fetchReceiverKey = async () => {
      if (!activeContactId) {
        setActivePublicKey("");
        return;
      }
      const targetId = canonicalPhone(activeContactId);
      const { data, error } = await supabase
        .from("user_keys")
        .select("public_key")
        .eq("phone_id", targetId)
        .single();

      if (data && data.public_key) {
        setActivePublicKey(data.public_key);
      } else {
        setActivePublicKey("");
        console.warn(
          "Target user belum mengaktifkan E2EE atau tidak ditemukan.",
        );
      }
    };

    fetchReceiverKey();
  }, [activeContactId]);

  // ====================================================================
  // 3. BLOK DEKRIPSI SEMUA PESAN (Biarkan tetap seperti ini)
  // ====================================================================
  useEffect(() => {
    const decryptAll = async () => {
      if (!myPrivateKey || messages.length === 0) return;

      const newDecrypted = { ...decryptedMessages };
      let updated = false;

      for (const msg of messages) {
        if (!newDecrypted[msg.id]) {
          // Jika pesan berupa JSON terenkripsi, dekripsi. Jika teks biasa, biarkan lolos.
          if (msg.text.startsWith('{"encryptedText"')) {
            newDecrypted[msg.id] = await decryptMessage(msg.text, myPrivateKey);
          } else {
            newDecrypted[msg.id] = msg.text;
          }
          updated = true;
        }
      }

      if (updated) {
        setDecryptedMessages(newDecrypted);
      }
    };

    decryptAll();
  }, [messages, myPrivateKey]);

  // Presence & Messages logic
  useEffect(() => {
    if (!myProfile.uniqueId) return;
    const myCanonId = canonicalPhone(myProfile.uniqueId);

    // Initial Fetch & Merge
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(`sender_id.eq."${myCanonId}",receiver_id.eq."${myCanonId}"`)
        .order("created_at", { ascending: true });
      if (data) {
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          data.forEach((m) => map.set(m.id, m));
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at),
          );
        });
      }
    };
    fetchMessages();

    // Presence Channel
    const presenceChannel = supabase.channel("online-presence", {
      config: { presence: { key: cleanPhone(myProfile.uniqueId) } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const newState = presenceChannel.presenceState();
        setOnlineUsers(newState);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            online_at: new Date().toISOString(),
            name: myProfile.name,
            avatar: myProfile.avatar,
          });
        }
      });

    // Messages Channel
    const msgChannel = supabase
      .channel("db-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newMsg = payload.new;
            const myId = canonicalPhone(myProfile.uniqueId);
            const rxId = canonicalPhone(newMsg.receiver_id || "");
            const txId = canonicalPhone(newMsg.sender_id || "");
            const activeId = canonicalPhone(activeChatRef.current);

            if (rxId === myId || txId === myId) {
              setMessages((prev) =>
                prev.find((m) => m.id === newMsg.id) ? prev : [...prev, newMsg],
              );

              if (rxId === myId) {
                setContacts((prev) => {
                  const existing = prev.find((c) => cleanPhone(c.id) === txId);
                  if (!existing) {
                    return [
                      ...prev,
                      {
                        id: canonicalPhone(newMsg.sender_id),
                        name: formatPhoneInput(newMsg.sender_id),
                        avatar: "?",
                        status: "Sedang Chat",
                      },
                    ];
                  } else if (existing.status === "Baru ditambahkan") {
                    return prev.map((c) =>
                      cleanPhone(c.id) === txId
                        ? { ...c, status: "Sedang Chat" }
                        : c,
                    );
                  }
                  return prev;
                });

                // === E2EE LOGIC ===
                // Dekripsi teks realtime untuk push notification
                let notifBody = newMsg.text;
                if (newMsg.text.startsWith('{"encryptedText"')) {
                  const privKey = localStorage.getItem("ischat_private_key");
                  notifBody = await decryptMessage(newMsg.text, privKey);
                }

                if (
                  txId !== activeId &&
                  Notification.permission === "granted"
                ) {
                  new Notification("Pesan Baru", {
                    body: notifBody,
                    icon: "/pwa-192x192.png",
                  });
                }

                if (txId === activeId) markAsRead(newMsg.id);
              }
            }
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m)),
            );
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [myProfile.uniqueId]);

  // Read sync
  useEffect(() => {
    if (!myProfile.uniqueId || !activeContactId || messages.length === 0)
      return;
    const unread = messages
      .filter(
        (m) =>
          cleanPhone(m.receiver_id) === cleanPhone(myProfile.uniqueId) &&
          cleanPhone(m.sender_id) === cleanPhone(activeContactId) &&
          m.status !== "read",
      )
      .map((m) => m.id);
    if (unread.length > 0) markAsRead(unread);
  }, [activeContactId, messages, myProfile.uniqueId]);

  const markAsRead = async (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    if (list.length > 0)
      await supabase.from("messages").update({ status: "read" }).in("id", list);
  };

  const handleDeleteForMe = (id) => setDeletedIds((prev) => [...prev, id]);

  const handleDeleteForEveryone = async (id) => {
    if (window.confirm("Hapus untuk semua orang?")) {
      await supabase.from("messages").delete().eq("id", id);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim() || !activeContactId) return;

    // === E2EE LOGIC ===
    // Pastikan Public Key penerima sudah siap ditarik
    if (!activePublicKey) {
      alert("Gagal mengirim: Menunggu kunci enkripsi penerima aman...");
      return;
    }

    const plainText = message; // Ambil teks asli untuk optimistic update lokal
    const tempId = `temp-${Date.now()}`;

    // Enkripsi isi pesan menggunakan public key penerima sebelum dikirim ke database
    const encryptedText = await encryptMessage(plainText, activePublicKey);

    const newMsg = {
      id: tempId,
      text: encryptedText, // Masuk ke state lokal berupa text terenkripsi
      sender_id: canonicalPhone(myProfile.uniqueId),
      receiver_id: canonicalPhone(activeContactId),
      status: "sending",
      created_at: new Date().toISOString(),
    };

    // Masukkan teks asli ke cache lokal agar pengirim bisa langsung membaca tanpa menunggu proses dekripsi ulang
    setDecryptedMessages((prev) => ({ ...prev, [tempId]: plainText }));

    // Optimistic Update
    setMessages((prev) => [...prev, newMsg]);
    setMessage("");

    setContacts((prev) =>
      prev.map((c) =>
        canonicalPhone(c.id) === canonicalPhone(activeContactId) &&
        c.status === "Baru saja ditambahkan"
          ? { ...c, status: "Sedang Chat" }
          : c,
      ),
    );

    const { data, error } = await supabase
      .from("messages")
      .insert([
        {
          text: newMsg.text, // Teks yang masuk ke Supabase dipastikan 100% AMAN (Bentuk JSON String acak)
          sender_id: newMsg.sender_id,
          receiver_id: newMsg.receiver_id,
          status: "sent",
          created_at: newMsg.created_at,
        },
      ])
      .select();

    if (error) {
      console.error("Send Error:", error);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "error" } : m)),
      );
      setTimeout(
        () => alert("Gagal mengirim pesan. Silakan cek koneksi internet Anda."),
        100,
      );
    } else if (data && data[0]) {
      // Petakan ID database asli ke cache teks asli
      setDecryptedMessages((prev) => ({ ...prev, [data[0].id]: plainText }));
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data[0] : m)));
    }
  };

  const handleAddContact = (e) => {
    e.preventDefault();
    if (!newContact.trim()) return;
    const canon = canonicalPhone(newContact);
    if (contacts.find((c) => cleanPhone(c.id) === cleanPhone(canon)))
      return alert("Ada.");
    setContacts((prev) => [
      ...prev,
      {
        id: canon,
        name: formatPhoneInput(canon),
        status: "Baru ditambahkan",
        avatar: "?",
      },
    ]);
    setNewContact("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () =>
        setMyProfile((prev) => ({ ...prev, avatar: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const startEditing = (c) => {
    setEditingContactId(c.id);
    setEditName(c.name);
  };
  const saveContactName = () => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === editingContactId ? { ...c, name: editName } : c,
      ),
    );
    setEditingContactId(null);
  };

  const activeContact = contacts.find(
    (c) => cleanPhone(c.id) === cleanPhone(activeContactId),
  ) || { avatar: "?", id: "", name: "" };

  return (
    <div className="chat-container">
      <aside
        className={`chat-sidebar ${mobileView === "contacts" ? "mobile-active" : ""}`}
      >
        <div className="sidebar-header">
          <LogoIcon className="sidebar-logo" /> <h2>ISChat</h2>
          <button
            className="profile-trigger"
            onClick={() => setShowProfileModal(true)}
          >
            <UserIcon className="sidebar-icon" />
          </button>
        </div>

        <form className="add-contact-bar" onSubmit={handleAddContact}>
          <div className="input-group">
            <UserPlusIcon className="input-icon" />
            <input
              type="text"
              placeholder="Nomor..."
              value={newContact}
              onChange={(e) => setNewContact(formatPhoneInput(e.target.value))}
            />
            <button type="submit" className="add-btn">
              Add
            </button>
          </div>
        </form>

        <div className="search-bar">
          <SearchIcon className="search-icon" />
          <input type="text" placeholder="Cari..." />
        </div>

        <div className="contact-list">
          {contacts.map((c) => {
            const cleanId = cleanPhone(c.id);
            const presence = onlineUsers[cleanId]?.[0];
            const isOnline = !!presence;

            const displayName =
              presence?.name || c.name || formatPhoneInput(c.id);
            const displayAvatar = presence?.avatar || c.avatar;

            const unread = messages.filter(
              (m) =>
                cleanPhone(m.sender_id) === cleanId &&
                cleanPhone(m.receiver_id) === cleanPhone(myProfile.uniqueId) &&
                m.status !== "read",
            ).length;

            return (
              <div
                key={c.id}
                className={`contact-item ${activeContactId === c.id ? "active" : ""}`}
                onClick={() => {
                  setActiveContactId(c.id);
                  if (window.innerWidth <= 768) setMobileView("messages");
                }}
              >
                <div className="avatar">
                  {displayAvatar && displayAvatar !== "?" ? (
                    <img src={displayAvatar} className="avatar-img" />
                  ) : displayName ? (
                    displayName.charAt(0)
                  ) : (
                    "?"
                  )}
                  {isOnline && <div className="online-indicator"></div>}
                  {unread > 0 && <span className="unread-dot">{unread}</span>}
                </div>
                <div className="contact-info">
                  <div className="name-row">
                    {editingContactId === c.id ? (
                      <input
                        className="edit-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={saveContactName}
                        onKeyDown={(e) =>
                          e.key === "Enter" && saveContactName()
                        }
                        autoFocus
                      />
                    ) : (
                      <>
                        <h4>{displayName}</h4>
                        <button
                          className="edit-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(c);
                          }}
                        >
                          <EditIcon />
                        </button>
                      </>
                    )}
                  </div>
                  <p className="contact-number">{formatPhoneInput(c.id)}</p>
                  <p className="contact-status">
                    {isOnline ? "Online" : c.status}
                  </p>
                </div>
                <button
                  className="delete-contact-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Hapus?"))
                      setContacts((prev) =>
                        prev.filter((cc) => cc.id !== c.id),
                      );
                  }}
                >
                  <TrashIcon className="sidebar-icon" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="sidebar-footer">
          <button
            className="version-btn"
            onClick={() => setShowVersionModal(true)}
          >
            <InfoIcon className="sidebar-icon" /> <span>v1.6.5</span>
          </button>
          <button className="settings-btn">
            <SettingsIcon className="sidebar-icon" />
          </button>
        </div>
      </aside>

      <main
        className={`chat-main ${mobileView === "messages" ? "mobile-active" : ""}`}
      >
        <header className="chat-header">
          {activeContactId ? (
            <div className="active-contact">
              <div className="avatar">
                {(onlineUsers[cleanPhone(activeContact.id)]?.[0]?.avatar ||
                  activeContact.avatar) &&
                (onlineUsers[cleanPhone(activeContact.id)]?.[0]?.avatar ||
                  activeContact.avatar) !== "?" ? (
                  <img
                    src={
                      onlineUsers[cleanPhone(activeContact.id)]?.[0]?.avatar ||
                      activeContact.avatar
                    }
                    className="avatar-img"
                  />
                ) : activeContact.name ? (
                  activeContact.name.charAt(0)
                ) : (
                  "?"
                )}
              </div>
              <div className="header-info">
                <h3>
                  {onlineUsers[cleanPhone(activeContact.id)]?.[0]?.name ||
                    activeContact.name ||
                    formatPhoneInput(activeContact.id)}
                </h3>
                <p className="status-indicator">
                  {formatPhoneInput(activeContact.id)} •{" "}
                  {onlineUsers[cleanPhone(activeContact.id)]
                    ? "Online"
                    : activeContact.status}
                </p>
              </div>
            </div>
          ) : (
            <div className="header-info">
              <h3>ISChat</h3>
            </div>
          )}
        </header>

        <div className="messages-area">
          {activeContactId ? (
            messages
              .filter(
                (m) =>
                  !deletedIds.includes(m.id) &&
                  ((cleanPhone(m.sender_id) ===
                    cleanPhone(myProfile.uniqueId) &&
                    cleanPhone(m.receiver_id) ===
                      cleanPhone(activeContactId)) ||
                    (cleanPhone(m.sender_id) === cleanPhone(activeContactId) &&
                      cleanPhone(m.receiver_id) ===
                        cleanPhone(myProfile.uniqueId))),
              )
              .map((msg) => (
                <div
                  key={msg.id}
                  className={`message-wrapper ${msg.sender_id === myProfile.uniqueId ? "user" : "bot"}`}
                >
                  <div className="message-bubble">
                    {/* === E2EE LOGIC === */}
                    {/* Tampilkan dari cache decryptedMessages, jika sedang didekripsi tampilkan loading kecil */}
                    <div className="message-content">
                      {decryptedMessages[msg.id] !== undefined
                        ? decryptedMessages[msg.id]
                        : "Mengonfirmasi Kunci Aman..."}
                    </div>
                    <div className="message-meta">
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {msg.sender_id === myProfile.uniqueId && (
                        <span className={`status-icon ${msg.status}`}>
                          {msg.status === "sending" && (
                            <span className="sending-loader">...</span>
                          )}
                          {msg.status === "error" && (
                            <span className="error-mark">!</span>
                          )}
                          {msg.status === "sent" && <SingleCheckIcon />}
                          {msg.status === "delivered" && <DoubleCheckIcon />}
                          {msg.status === "read" && (
                            <DoubleCheckIcon className="read" />
                          )}
                        </span>
                      )}
                    </div>
                    <div className="message-actions">
                      <button
                        className="action-btn"
                        onClick={() => handleDeleteForMe(msg.id)}
                      >
                        Hapus Saya
                      </button>
                      {msg.sender_id === myProfile.uniqueId && (
                        <button
                          className="action-btn delete"
                          onClick={() => handleDeleteForEveryone(msg.id)}
                        >
                          Hapus Semua
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
          ) : (
            <div className="empty-chat">
              <p>Pilih chat untuk memulai.</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Ketik..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button type="submit" className="send-btn">
            <SendIcon className="btn-icon-svg" />
          </button>
        </form>
      </main>

      <nav className="mobile-bottom-nav">
        <button
          className={`nav-item ${mobileView === "contacts" ? "active" : ""}`}
          onClick={() => setMobileView("contacts")}
        >
          <UsersIcon />
          <span>Kontak</span>
        </button>
        <button
          className={`nav-item ${mobileView === "messages" ? "active" : ""}`}
          onClick={() => setMobileView("messages")}
        >
          <MessageSquareIcon />
          <span>Chat</span>
        </button>
        <button className="nav-item" onClick={() => setShowProfileModal(true)}>
          <UserIcon />
          <span>Profil</span>
        </button>
      </nav>

      {showProfileModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="modal-content glass-card profile-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-photo-wrap">
              <div className="avatar-large">
                {myProfile.avatar ? (
                  <img src={myProfile.avatar} className="avatar-img" />
                ) : myProfile.name ? (
                  myProfile.name.charAt(0)
                ) : (
                  "P"
                )}
                <label className="photo-upload-btn">
                  <CameraIcon />
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            </div>

            <div className="profile-identity-card">
              <label>Nomor Anda</label>
              <h2 className="profile-phone-large">
                {formatPhoneInput(myProfile.uniqueId)}
              </h2>
            </div>

            <div className="profile-info-edit">
              <label className="input-label">Nama Tampilan</label>
              <input
                className="profile-name-input"
                value={myProfile.name}
                onChange={(e) =>
                  setMyProfile({ ...myProfile, name: e.target.value })
                }
                placeholder="Nama Anda"
              />
              <p className="status-text">{myProfile.status}</p>
            </div>
            <div className="unique-id-box">
              <label>ID Unik (Berikan ke teman)</label>
              <div className="id-card">
                <span className="id-number">
                  {formatPhoneInput(myProfile.uniqueId)}
                </span>
                <button
                  className="copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(
                      formatPhoneInput(myProfile.uniqueId),
                    );
                    alert("Disalin!");
                  }}
                >
                  Salin
                </button>
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowProfileModal(false)}
            >
              Selesai
            </button>
          </div>
        </div>
      )}

      {showVersionModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowVersionModal(false)}
        >
          <div
            className="modal-content glass-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>History Update</h3>
            <div className="version-list">
              {versionHistory.map((v) => (
                <div key={v.v} className="version-item">
                  <span className="v-tag">{v.v}</span>
                  <p>{v.detail}</p>
                </div>
              ))}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowVersionModal(false)}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatView;
