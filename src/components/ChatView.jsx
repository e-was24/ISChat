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
  const [showAdminModal, setShowAdminModal] = useState(false);

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

  // === FUNGSI GENERATE DEVICE FINGERPRINT (ANTI-CLEAR CACHE / ANTI-LOST) ===
  const getDeviceFingerprint = () => {
    const navigatorInfo =
      window.navigator.userAgent + window.navigator.language;
    const screenInfo =
      window.screen.width +
      "x" +
      window.screen.height +
      "x" +
      window.screen.colorDepth;
    const rawString = `${navigatorInfo}|${screenInfo}`;
    let hash = 0;
    for (let i = 0; i < rawString.length; i++) {
      const char = rawString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return "dev-" + Math.abs(hash);
  };

  // === KOMPONEN PANEL KELOLA USER (ADMIN) ===
  const UserManagementModal = ({ isOpen, onClose }) => {
    const [cloudProfiles, setCloudProfiles] = useState([]);
    const [searchFilter, setSearchFilter] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [newPhoneInput, setNewPhoneInput] = useState("");

    // Fetch semua user dari Supabase
    const fetchAllProfiles = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, device_fingerprint, updated_at")
        .order("updated_at", { ascending: false });
      if (data && !error) setCloudProfiles(data);
    };

    useEffect(() => {
      if (isOpen) fetchAllProfiles();
    }, [isOpen]);

    // Fungsi untuk update nomor HP tanpa mengubah sidik jari device
    const handleUpdateUserPhone = async (oldId, fingerprint) => {
      if (!newPhoneInput.trim()) return alert("Nomor baru tidak boleh kosong!");
      const newCanonId = canonicalPhone(newPhoneInput);

      if (
        window.confirm(
          `Yakin ingin mengubah nomor user ini menjadi ${newCanonId}?`,
        )
      ) {
        try {
          // 1. Cek apakah nomor baru sudah dipakai oleh device lain
          const { data: existing } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", newCanonId)
            .maybeSingle();

          if (existing && existing.id !== oldId) {
            return alert(
              "Gagal: Nomor tersebut sudah terdaftar di device lain! Gunakan nomor lain untuk mencegah duplikat.",
            );
          }

          // 2. Jika nomor berubah, kita hapus dulu row id yang lama agar tidak duplikat di primary key
          if (oldId !== newCanonId) {
            await supabase.from("profiles").delete().eq("id", oldId);
          }

          // 3. Masukkan data dengan ID nomor yang baru, tapi fingerprint TETAP SAMA
          await supabase.from("profiles").upsert({
            id: newCanonId,
            device_fingerprint: fingerprint,
            updated_at: new Date().toISOString(),
          });

          alert("Nomor user berhasil dipulihkan dan dikunci ke device lama!");
          setEditingId(null);
          setNewPhoneInput("");
          fetchAllProfiles(); // Refresh list
        } catch (err) {
          console.error(err);
          alert("Gagal memperbarui nomor user.");
        }
      }
    };

    if (!isOpen) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content glass-card"
          onClick={(e) => e.stopPropagation()}
          style={{ maxWidth: "600px", width: "100%" }}
        >
          <h3>Panel Kelola User & Pemulihan Nomor</h3>
          <p style={{ fontSize: "12px", color: "#aaa", marginBottom: "15px" }}>
            Gunakan panel ini untuk memetakan ulang nomor HP yang hilang tanpa
            merusak sidik jari perangkat (Anti-Duplikat).
          </p>

          <input
            type="text"
            placeholder="Cari sidik jari atau nomor..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "6px",
              background: "#222",
              color: "#fff",
              border: "1px solid #444",
              marginBottom: "15px",
            }}
          />

          <div
            className="admin-user-list"
            style={{
              maxHeight: "300px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {cloudProfiles
              .filter(
                (p) =>
                  p.id.includes(searchFilter) ||
                  (p.device_fingerprint &&
                    p.device_fingerprint.includes(searchFilter)),
              )
              .map((user) => (
                <div
                  key={user.id}
                  style={{
                    background: "#1a1a1a",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid #333",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "between",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <strong style={{ color: "#00adb5" }}>
                        {user.id || "(Nomor Kosong)"}
                      </strong>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#888",
                          marginTop: "4px",
                        }}
                      >
                        Device ID:{" "}
                        <span style={{ color: "#ff8a00" }}>
                          {user.device_fingerprint || "Tidak Ada"}
                        </span>
                      </div>
                    </div>

                    {editingId === user.id ? (
                      <div
                        style={{
                          display: "flex",
                          gap: "5px",
                          marginTop: "5px",
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Nomor baru..."
                          value={newPhoneInput}
                          onChange={(e) => setNewPhoneInput(e.target.value)}
                          style={{
                            padding: "4px",
                            background: "#333",
                            color: "#fff",
                            border: "1px solid #555",
                            borderRadius: "4px",
                            fontSize: "12px",
                          }}
                        />
                        <button
                          onClick={() =>
                            handleUpdateUserPhone(
                              user.id,
                              user.device_fingerprint,
                            )
                          }
                          style={{
                            background: "#28a745",
                            color: "#fff",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            background: "#dc3545",
                            color: "#fff",
                            border: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(user.id);
                          setNewPhoneInput(user.id);
                        }}
                        style={{
                          background: "#444",
                          color: "#fff",
                          border: "none",
                          padding: "5px 10px",
                          borderRadius: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                        }}
                      >
                        Pulihkan Nomor
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>

          <button
            className="btn btn-secondary"
            onClick={onClose}
            style={{ marginTop: "15px", width: "100%", background: "#333" }}
          >
            Tutup Panel
          </button>
        </div>
      </div>
    );
  };

  // === E2EE LOGIC STATES ===
  const [myPrivateKey, setMyPrivateKey] = useState("");
  const [activePublicKey, setActivePublicKey] = useState("");
  const [decryptedMessages, setDecryptedMessages] = useState({});

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

  const currentVersion = "1.6.8"; // Dinaikkan ke 1.6.8 agar memaksa PWA memperbarui cache rusak

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

  // ====================================================================
  // LOAD INITIAL & CLOUD PROFILE RESTORE (VERSION 100% ANTI-LOST & ANTI-EMPTY)
  // ====================================================================
  useEffect(() => {
    // 1. Ambil data cadangan yang ada di memori lokal HP terlebih dahulu
    const profile = db.getProfile();
    const savedContacts = db.getContacts();
    const savedIds = db.getDeletedMessages();

    const canonProfile = {
      ...profile,
      uniqueId: profile?.uniqueId ? canonicalPhone(profile.uniqueId) : "",
    };
    const canonContacts = savedContacts.map((c) => ({
      ...c,
      id: canonicalPhone(c.id),
    }));

    // 2. Masukkan data lokal ke State React agar UI tidak nge-blank / kosong
    setContacts(canonContacts);
    setDeletedIds(savedIds);
    setMessages(db.getMessages());
    if (canonContacts.length > 0) setActiveContactId(canonContacts[0].id);

    // 3. Fungsi sinkronisasi dan penguncian Sidik Jari Device ke cloud Supabase
    const lockDeviceToProfile = async () => {
      const fingerprint = getDeviceFingerprint();

      // KONDISI A: Jika di LocalStorage BENAR-BENAR kosong (bukan karena refresh bug, tapi beneran user baru)
      if (!canonProfile.uniqueId || canonProfile.uniqueId.trim() === "") {
        console.log(
          "LocalStorage kosong. Mencari nomor berdasarkan Device Fingerprint...",
        );

        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("id, name, avatar")
            .eq("device_fingerprint", fingerprint)
            .maybeSingle(); // maybeSingle tidak melempar fatal error jika data kosong

          // HANYA pasang profile jika data dari cloud beneran ditemukan dan tidak error
          if (data && data.id && !error) {
            const restoredProfile = {
              uniqueId: data.id,
              name: data.name || "User " + data.id.slice(-4),
              avatar: data.avatar || "?",
            };
            setMyProfile(restoredProfile);
            db.saveProfile(restoredProfile);
            console.log(
              "Sukses memulihkan nomor lama untuk device ini:",
              data.id,
            );
            return;
          } else {
            console.log(
              "Device fingerprint belum terikat dengan nomor manapun di cloud.",
            );
          }
        } catch (fetchErr) {
          console.error(
            "Gagal melakukan restore profile dari cloud:",
            fetchErr,
          );
        }
      }

      // KONDISI B & C: Jika di LocalStorage SUDAH ADA nomornya (JANGAN PERNAH DI-OVERRIDE JADI KOSONG!)
      if (canonProfile.uniqueId && canonProfile.uniqueId.trim() !== "") {
        // Kunci Utama: Selalu utamakan nomor lokal yang sudah ada biar gak hilang layarnya
        setMyProfile(canonProfile);

        try {
          // 1. Cek status fingerprint nomor ini di database cloud Supabase
          const { data: cloudData, error: readError } = await supabase
            .from("profiles")
            .select("device_fingerprint")
            .eq("id", canonProfile.uniqueId)
            .maybeSingle();

          if (readError) throw readError;

          // 2. Jika di cloud belum ada sidik jarinya (Kondisi User Lama), lakukan silent auto-update serentak
          if (!cloudData || !cloudData.device_fingerprint) {
            console.log(
              "User lama terdeteksi belum punya fingerprint. Menjalankan silent auto-update...",
            );
            await supabase.from("profiles").upsert({
              id: canonProfile.uniqueId,
              name: canonProfile.name,
              avatar: canonProfile.avatar,
              device_fingerprint: fingerprint, // Kunci device di sini
              updated_at: new Date().toISOString(),
            });
            console.log(
              "Fingerprint berhasil dipasang serentak di background.",
            );
          }
        } catch (cloudErr) {
          // Jika internet putus, biarkan saja data lokal tetap aman dan utuh
          console.error(
            "Gagal sinkronisasi fingerprint ke cloud (Offline/Error), mengamankan data lokal:",
            cloudErr,
          );
        }
      }
    };

    lockDeviceToProfile();
  }, []); // Hanya berjalan 1 kali pas aplikasi pertama kali di-load / refresh

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
  // 1. BLOK INISIALISASI KUNCI USER (VERSI AMAN ANTI-RESET)
  // ====================================================================
  useEffect(() => {
    const initE2EE = async () => {
      if (!myProfile.uniqueId || myProfile.uniqueId.trim() === "") return;

      const myCanonId = canonicalPhone(myProfile.uniqueId);
      let privKey = localStorage.getItem("ischat_private_key");
      let pubKey = localStorage.getItem("ischat_public_key");

      if (!privKey || !pubKey) {
        console.log(
          "Memicu generate E2EE Key Pair pertama kali untuk nomor:",
          myCanonId,
        );
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

      await supabase.from("user_keys").upsert({
        phone_id: myCanonId,
        public_key: pubKey,
        updated_at: new Date().toISOString(),
      });
    };

    initE2EE();
  }, [myProfile.uniqueId]);

  // ====================================================================
  // 2. BLOK MENGAMBIL KUNCI PENERIMA CHAT AKTIF
  // ====================================================================
  useEffect(() => {
    const fetchReceiverKey = async () => {
      if (!activeContactId) {
        setActivePublicKey("");
        return;
      }
      const targetId = canonicalPhone(activeContactId);
      const { data } = await supabase
        .from("user_keys")
        .select("public_key")
        .eq("phone_id", targetId)
        .single();

      if (data && data.public_key) {
        setActivePublicKey(data.public_key);
      } else {
        setActivePublicKey("");
      }
    };

    fetchReceiverKey();
  }, [activeContactId]);

  // ====================================================================
  // 3. BLOK DEKRIPSI SEMUA PESAN (VERSI FIX ANTI-LOOP)
  // ====================================================================
  useEffect(() => {
    const decryptAll = async () => {
      if (!myPrivateKey || messages.length === 0) return;

      const newDecrypted = { ...decryptedMessages };
      let updated = false;

      for (const msg of messages) {
        if (newDecrypted[msg.id] === undefined) {
          if (msg.text && msg.text.startsWith('{"encryptedText"')) {
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

  // ====================================================================
  // 4. REALTIME LOGIC (PRESENCE & LIVE REALTIME PROFILE AUTO-UPDATE)
  // ====================================================================
  useEffect(() => {
    if (!myProfile.uniqueId) return;
    const myCanonId = canonicalPhone(myProfile.uniqueId);

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

    // Urutan pendaftaran .on dulu baru .subscribe (ANTI-CRASH)
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
                const targetQueryId = canonicalPhone(txId);

                // Tarik profil paling update milik pengirim dari cloud secara live
                const { data: cloudProf } = await supabase
                  .from("profiles")
                  .select("name, avatar")
                  .eq("id", targetQueryId)
                  .maybeSingle();

                setContacts((prev) => {
                  const txIdClean = cleanPhone(txId);
                  const existing = prev.find(
                    (c) => cleanPhone(c.id) === txIdClean,
                  );

                  const liveName =
                    cloudProf?.name ||
                    (existing ? existing.name : formatPhoneInput(txId));
                  const liveAvatar =
                    cloudProf?.avatar || (existing ? existing.avatar : "?");

                  if (!existing) {
                    return [
                      ...prev,
                      {
                        id: txId,
                        name: liveName,
                        avatar: liveAvatar,
                        status: "Sedang Chat",
                      },
                    ];
                  } else {
                    return prev.map((c) =>
                      cleanPhone(c.id) === txIdClean
                        ? {
                            ...c,
                            name: liveName,
                            avatar: liveAvatar,
                            status: "Sedang Chat",
                          }
                        : c,
                    );
                  }
                });

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

    if (!activePublicKey) {
      alert("Gagal mengirim: Menunggu kunci enkripsi penerima aman...");
      return;
    }

    const plainText = message;
    const tempId = `temp-${Date.now()}`;
    const encryptedText = await encryptMessage(plainText, activePublicKey);

    const newMsg = {
      id: tempId,
      text: encryptedText,
      sender_id: canonicalPhone(myProfile.uniqueId),
      receiver_id: canonicalPhone(activeContactId),
      status: "sending",
      created_at: new Date().toISOString(),
    };

    setDecryptedMessages((prev) => ({ ...prev, [tempId]: plainText }));
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
          text: newMsg.text,
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
      setDecryptedMessages((prev) => ({ ...prev, [data[0].id]: plainText }));
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data[0] : m)));
    }
  };

  // === SIMPAN PROFIL KE SUPABASE + IKAT DEVICE FINGERPRINT ===
  const handleSaveProfile = async () => {
    if (!myProfile.uniqueId) return;
    const myCanonId = canonicalPhone(myProfile.uniqueId);
    const fingerprint = getDeviceFingerprint();

    try {
      db.saveProfile(myProfile);

      const { error } = await supabase.from("profiles").upsert({
        id: myCanonId,
        name: myProfile.name,
        avatar: myProfile.avatar,
        device_fingerprint: fingerprint,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      alert("Profil dan Device Anda berhasil dikunci di cloud!");
      setShowProfileModal(false);
    } catch (err) {
      console.error("Gagal mengunggah profil:", err);
      alert("Gagal menyimpan profil ke cloud. Silakan cek koneksi Anda.");
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContact.trim()) return;

    const canon = canonicalPhone(newContact);
    const canonClean = cleanPhone(canon);

    if (contacts.find((c) => cleanPhone(c.id) === canonClean)) {
      return alert("Kontak sudah ada.");
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, avatar")
        .eq("id", canon)
        .single();

      const cloudName = data && !error ? data.name : formatPhoneInput(canon);
      const cloudAvatar = data && !error ? data.avatar : "?";

      setContacts((prev) => [
        ...prev,
        {
          id: canon,
          name: cloudName,
          status: "Baru ditambahkan",
          avatar: cloudAvatar,
        },
      ]);
    } catch (err) {
      console.error("Gagal menarik profil kontak dari cloud:", err);
      setContacts((prev) => [
        ...prev,
        {
          id: canon,
          name: formatPhoneInput(canon),
          status: "Baru ditambahkan",
          avatar: "?",
        },
      ]);
    }

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
          <LogoIcon className="sidebar-logo" />{" "}
          <h2
            onClick={() => setShowAdminModal(true)}
            style={{ cursor: "pointer" }}
          >
            ISChat
          </h2>
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
            <InfoIcon className="sidebar-icon" /> <span>v{currentVersion}</span>
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
                          {msg.status === "sent" && (
                            <SendIcon
                              style={{ width: "12px", height: "12px" }}
                            />
                          )}
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

            <div
              className="profile-action-buttons"
              style={{ display: "flex", gap: "10px", marginTop: "15px" }}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveProfile}
                style={{ width: "100%" }}
              >
                Simpan Profil
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowProfileModal(false)}
                style={{
                  width: "100%",
                  background: "#444",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                }}
              >
                Batal
              </button>
            </div>
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
      {/* Panggil Modal Admin Kelola User */}
      <UserManagementModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />
    </div>
  );
};

export default ChatView;
