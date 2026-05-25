/**
 * Utilitas Kriptografi untuk End-to-End Encryption (E2EE)
 * Menggunakan Web Crypto API (RSA-OAEP & AES-GCM)
 */

// Helper: Mengubah ArrayBuffer ke Base64 String
const bufferToBase64 = (buffer) => {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
};

// Helper: Mengubah Base64 String ke ArrayBuffer
const base64ToBuffer = (base64) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * 1. Membuat Sepasang Kunci Baru (Public & Private)
 * @returns {Promise<{publicKey: string, privateKey: string}>}
 */
export const generateKeyPair = async () => {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true, // dapat diekspor
      ["encrypt", "decrypt"],
    );

    // Ekspor ke format SPKI (Public Key) dan PKCS8 (Private Key)
    const publicKeyBuf = await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey,
    );
    const privateKeyBuf = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey,
    );

    return {
      publicKey: bufferToBase64(publicKeyBuf),
      privateKey: bufferToBase64(privateKeyBuf),
    };
  } catch (error) {
    console.error("Gagal membuat Key Pair:", error);
    throw error;
  }
};

/**
 * 2. Mengenkripsi Pesan Teks menggunakan Public Key Penerima
 * @param {string} text - Pesan teks biasa
 * @param {string} receiverPublicKeyBase64 - Public key milik penerima
 * @returns {Promise<string>} String JSON terenkripsi (aman dikirim ke Supabase)
 */
export const encryptMessage = async (text, receiverPublicKeyBase64) => {
  try {
    if (!receiverPublicKeyBase64)
      throw new Error("Public key penerima tidak ditemukan.");

    // Impor Public Key Penerima
    const publicKeyBuf = base64ToBuffer(receiverPublicKeyBase64);
    const publicKey = await window.crypto.subtle.importKey(
      "spki",
      publicKeyBuf,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"],
    );

    // Generate Kunci Simetris Acak (AES-GCM) untuk mengenkripsi teks pesan
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    // Generate IV (Initialization Vector) acak untuk AES
    const iv = window.crypto.crypto64
      ? new Uint8Array(12)
      : window.crypto.getRandomValues(new Uint8Array(12));

    // Enkripsi teks pesan pakai AES-GCM
    const encoder = new TextEncoder();
    const encryptedTextBuf = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encoder.encode(text),
    );

    // Ekspor AES key untuk dikunci pakai RSA milik penerima
    const aesKeyBuf = await window.crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKeyBuf = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      aesKeyBuf,
    );

    // Bungkus semua komponen menjadi satu payload JSON terenkripsi
    const payload = {
      encryptedText: bufferToBase64(encryptedTextBuf),
      encryptedKey: bufferToBase64(encryptedAesKeyBuf),
      iv: bufferToBase64(iv),
    };

    return JSON.stringify(payload);
  } catch (error) {
    console.error("Proses enkripsi gagal:", error);
    return text; // Fallback ke teks biasa jika gagal (atau bisa di-handle sebagai error)
  }
};

/**
 * 3. Mendekripsi Pesan Terenkripsi menggunakan Private Key Sendiri
 * @param {string} encryptedPayloadJson - Payload JSON terenkripsi dari database
 * @param {string} myPrivateKeyBase64 - Private key milik sendiri (dari localStorage)
 * @returns {Promise<string>} Teks pesan asli
 */
export const decryptMessage = async (
  encryptedPayloadJson,
  myPrivateKeyBase64,
) => {
  try {
    // Jika data bukan format JSON terenkripsi kita, kembalikan teks langsung (pesan lama sebelum E2EE)
    if (!encryptedPayloadJson.startsWith('{"encryptedText"')) {
      return encryptedPayloadJson;
    }

    const payload = JSON.parse(encryptedPayloadJson);
    if (!myPrivateKeyBase64)
      throw new Error("Private key Anda tidak ditemukan.");

    // Impor Private Key Sendiri
    const privateKeyBuf = base64ToBuffer(myPrivateKeyBase64);
    const privateKey = await window.crypto.subtle.importKey(
      "pkcs8",
      privateKeyBuf,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"],
    );

    // Dekripsi AES Key menggunakan RSA Private Key kita
    const encryptedKeyBuf = base64ToBuffer(payload.encryptedKey);
    const aesKeyBuf = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedKeyBuf,
    );

    // Impor kembali AES Key yang sudah lolos dekripsi
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      aesKeyBuf,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );

    // Dekripsi teks pesan asli memakai AES-GCM dan IV bawaannya
    const encryptedTextBuf = base64ToBuffer(payload.encryptedText);
    const ivBuf = base64ToBuffer(payload.iv);

    const decryptedBuf = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(ivBuf) },
      aesKey,
      encryptedTextBuf,
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuf);
  } catch (error) {
    console.error("Proses dekripsi gagal:", error);
    return "[Gagal mendekripsi pesan. Kunci tidak cocok.]";
  }
};
