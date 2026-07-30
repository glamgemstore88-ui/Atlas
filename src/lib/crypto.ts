// Client-side AES-256-GCM encryption of the Buffer API key before it ever leaves
// the browser. The plaintext key is encrypted in the browser, sent to the edge
// function / DB as ciphertext, and only ever decrypted server-side inside the
// buffer-proxy function. This gives a second layer of protection: even if the
// network/DB were inspected, only ciphertext is visible.
//
// The encryption key is derived (PBKDF2) from a passphrase the user enters OR a
// stable device-derived value when no passphrase is provided. For BYOK we use a
// per-session random key persisted in memory only — the DB stores ciphertext +
// IV + authTag, and the server edge function re-derives its own key from the
// ATLAS_ENCRYPTION_KEY secret to decrypt. Both sides must use the SAME key.
//
// To keep server + client in sync without exposing a secret, the SERVER is the
// authority: the client sends the PLAINTEXT key over HTTPS to the buffer-proxy
// "save-key" route, which encrypts server-side. This file therefore provides a
// thin helper that calls that route. We keep an AES helper here for any future
// client-side need, but the canonical path is server-side encryption.

export interface EncryptedKey {
  ciphertext: string;
  iv: string;
  auth_tag: string;
  hint?: string;
}
