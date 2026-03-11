const encoder = new TextEncoder();
const decoder = new TextDecoder();

let sessionPassword = "";

export function setSessionPassword(password: string) {
  sessionPassword = password;
}

export function getSessionPassword() {
  return sessionPassword;
}

async function generateKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptData(data: string, password: string) {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await generateKey(password, salt);
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(data),
  );

  return {
    cipher: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptData(cipher: string, saltStr: string, ivStr: string, password: string) {
  const salt = Uint8Array.from(atob(saltStr), (char) => char.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivStr), (char) => char.charCodeAt(0));
  const data = Uint8Array.from(atob(cipher), (char) => char.charCodeAt(0));
  const key = await generateKey(password, salt);
  const decrypted = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return decoder.decode(decrypted);
}
