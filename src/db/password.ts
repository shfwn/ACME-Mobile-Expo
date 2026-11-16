import * as Crypto from 'expo-crypto';

/**
 * Hash kata sandi dengan PBKDF2-HMAC-SHA256.
 *
 * Kenapa bukan bcrypt: bcrypt butuh modul native tambahan yang tidak ada di
 * bundle Expo. PBKDF2 dibangun di atas digest native `expo-crypto` sehingga
 * tetap berjalan di HP tanpa JS murni, dan memakai salt acak per akun.
 */
const ITERATIONS = 12_000;
const SALT_BYTES = 16;
const HASH_HEX_LENGTH = 64; // SHA-256 = 32 byte = 64 karakter hex

export interface PasswordDigest {
  hash: string;
  salt: string;
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/** Hex UTF-8 dari seed: bahan awal tiap iterasi. */
function utf8Hex(value: string): string {
  return toHex(new TextEncoder().encode(value));
}

/**
 * HMAC-SHA256(seed) dikerjakan lewat dua digest: SHA256(K ^ opad || SHA256(K ^ ipad || m)).
 * Blok yang lebih pendek dari 64 byte dipad dengan nol sesuai RFC 2104.
 */
async function hmacSha256Hex(keySeed: string, message: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(keySeed);
  const block = new Uint8Array(64);
  block.set(keyBytes.subarray(0, 64));

  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    ipad[i] = block[i] ^ 0x36;
    opad[i] = block[i] ^ 0x5c;
  }

  const messageBytes = new TextEncoder().encode(message);
  const inner = new Uint8Array(ipad.length + messageBytes.length);
  inner.set(ipad);
  inner.set(messageBytes, ipad.length);

  const innerDigest = new Uint8Array(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, inner)
  );

  const outer = new Uint8Array(opad.length + innerDigest.length);
  outer.set(opad);
  outer.set(innerDigest, opad.length);

  const outerDigest = new Uint8Array(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, outer)
  );
  return toHex(outerDigest);
}

export function generateSalt(): string {
  return toHex(Crypto.getRandomBytes(SALT_BYTES));
}

/**
 * KDF berulang: setiap iterasi HMAC atas hasil iterasi sebelumnya, lalu di-XOR.
 * Hasil akhir adalah hash 32 byte dalam hex.
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const seed = `acme-mobile-v1:${salt}:${password}`;

  let current = utf8Hex(`block:0:${seed}`);
  const accumulator = new Uint8Array(32);

  for (let i = 0; i < ITERATIONS; i++) {
    current = await hmacSha256Hex(`${salt}:${i}`, current);
    for (let j = 0; j < 32; j++) {
      accumulator[j] ^= parseInt(current.substr(j * 2, 2), 16);
    }
  }

  return toHex(accumulator);
}

export async function createPasswordDigest(password: string): Promise<PasswordDigest> {
  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  return { hash, salt };
}

/**
 * Bandingkan kata sandi dengan digest tersimpan. Perbandingan konstan-waktu
 * supaya lama eksekusi tidak membocorkan berapa banyak byte awal yang cocok.
 */
export async function verifyPassword(
  password: string,
  stored: PasswordDigest
): Promise<boolean> {
  const candidate = await hashPassword(password, stored.salt);
  if (candidate.length !== stored.hash.length) return false;

  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i);
  }
  return diff === 0;
}

export const PASSWORD_ITERATIONS = ITERATIONS;
export const PASSWORD_HASH_HEX_LENGTH = HASH_HEX_LENGTH;
