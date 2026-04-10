// Simple LocalStorage Database Utility
const DB_KEYS = {
  PROFILE: 'ischat_profile',
  CONTACTS: 'ischat_contacts',
  MESSAGES: 'ischat_messages'
};

const defaultProfile = () => ({
  name: 'Pengguna ISChat',
  uniqueId: `+62 ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
  status: 'Tersedia'
});

const defaultContacts = [
  { id: 'ai-init', name: 'Support Assistant', status: 'Online', avatar: 'AI' }
];

export const db = {
  getProfile: () => {
    const data = localStorage.getItem(DB_KEYS.PROFILE);
    if (!data) {
      const profile = defaultProfile();
      localStorage.setItem(DB_KEYS.PROFILE, JSON.stringify(profile));
      return profile;
    }
    return JSON.parse(data);
  },

  getContacts: () => {
    const data = localStorage.getItem(DB_KEYS.CONTACTS);
    return data ? JSON.parse(data) : defaultContacts;
  },

  saveContacts: (contacts) => {
    localStorage.setItem(DB_KEYS.CONTACTS, JSON.stringify(contacts));
  },

  getMessages: () => {
    const data = localStorage.getItem(DB_KEYS.MESSAGES);
    return data ? JSON.parse(data) : [];
  },

  saveMessages: (messages) => {
    localStorage.setItem(DB_KEYS.MESSAGES, JSON.stringify(messages));
  },

  getDeletedMessages: () => {
    const data = localStorage.getItem('ischat_deleted_ids');
    return data ? JSON.parse(data) : [];
  },

  saveDeletedMessages: (ids) => {
    localStorage.setItem('ischat_deleted_ids', JSON.stringify(ids));
  }
};
