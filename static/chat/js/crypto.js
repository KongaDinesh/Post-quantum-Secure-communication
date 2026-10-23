
import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';

const DB_NAME = 'pqc-chat-db';
const STORE_NAME = 'keys';
const STORAGE_VERSION = 2;
const PBKDF2_ITERATIONS = 600000;
const MESSAGE_ALGORITHM = 'ML-KEM-768+AES-256-GCM';

function getUserKeyId() {
    const username = document.body?.dataset?.username;

    if (!username) {
        throw new Error(
            'Username is missing. Add data-username to the conversation page.'
        );
    }

    return `ml-kem-768-${encodeURIComponent(username)}`;
}

function toBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(i, i + chunkSize)
        );
    }

    return btoa(binary);
}

function fromBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return bytes;
}

function openKeyDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function readKeyRecord() {
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const request = transaction
            .objectStore(STORE_NAME)
            .get(getUserKeyId());

        request.onsuccess = () => {
            resolve(request.result || null);
            db.close();
        };

        request.onerror = () => {
            reject(request.error);
            db.close();
        };
    });
}

async function saveKeyRecord(record) {
    const db = await openKeyDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(record);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };

        transaction.onabort = () => {
            db.close();
            reject(
                transaction.error ||
                new Error('Key storage transaction aborted.')
            );
        };
    });
}

async function deriveStorageKey(passphrase, salt) {
    const material = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(passphrase),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptPrivateKey(secretKey, passphrase, publicKey) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const storageKey = await deriveStorageKey(passphrase, salt);

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        storageKey,
        secretKey
    );

    return {
        id: getUserKeyId(),
        algorithm: 'ML-KEM-768',
        publicKey: toBase64(publicKey),
        encryptedSecretKey: toBase64(new Uint8Array(encrypted)),
        salt: toBase64(salt),
        iv: toBase64(iv),
        storageVersion: STORAGE_VERSION
    };
}

async function decryptPrivateKey(record, passphrase) {
    if (
        record.storageVersion !== STORAGE_VERSION ||
        !record.encryptedSecretKey ||
        !record.publicKey ||
        !record.salt ||
        !record.iv
    ) {
        throw new Error(
            'Stored key record has an unsupported format.'
        );
    }

    const salt = fromBase64(record.salt);
    const iv = fromBase64(record.iv);
    const encrypted = fromBase64(record.encryptedSecretKey);
    const storageKey = await deriveStorageKey(passphrase, salt);

    const secretKey = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        storageKey,
        encrypted
    );

    return {
        publicKey: fromBase64(record.publicKey),
        secretKey: new Uint8Array(secretKey)
    };
}

export async function getOrCreatePqcKeyPair(passphrase) {
    if (typeof passphrase !== 'string' || passphrase.length < 12) {
        throw new Error('Use a passphrase with at least 12 characters.');
    }

    const record = await readKeyRecord();

    if (record) {
        const keyPair = await decryptPrivateKey(record, passphrase);
        console.log('Existing ML-KEM-768 key unlocked.');
        return keyPair;
    }

    const generated = ml_kem768.keygen();
    const publicKey = new Uint8Array(generated.publicKey);
    const secretKey = new Uint8Array(generated.secretKey);

    if (publicKey.length !== 1184 || secretKey.length !== 2400) {
        throw new Error('Unexpected ML-KEM-768 key sizes.');
    }

    const encryptedRecord = await encryptPrivateKey(
        secretKey,
        passphrase,
        publicKey
    );

    await saveKeyRecord(encryptedRecord);

    console.log('New ML-KEM-768 key pair generated and stored.');
    return { publicKey, secretKey };
}

export function testPqcLibrary() {
    const pair = ml_kem768.keygen();

    if (pair.publicKey.length !== 1184 || pair.secretKey.length !== 2400) {
        throw new Error('ML-KEM-768 key-size test failed.');
    }

    console.log('ML-KEM-768 key-generation test passed.');
}

export function testKemExchange() {
    const bob = ml_kem768.keygen();

    const encapsulated = ml_kem768.encapsulate(bob.publicKey);

    const recoveredSecret = ml_kem768.decapsulate(
        encapsulated.cipherText,
        bob.secretKey
    );

    const same =
        encapsulated.sharedSecret.length === recoveredSecret.length &&
        encapsulated.sharedSecret.every(
            (byte, index) => byte === recoveredSecret[index]
        );

    if (!same) {
        throw new Error('KEM shared-secret exchange test failed.');
    }

    console.log('ML-KEM-768 KEM exchange test passed.');
}

async function deriveMessageKey(sharedSecret, salt) {
    const material = await crypto.subtle.importKey(
        'raw',
        sharedSecret,
        'HKDF',
        false,
        ['deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'HKDF',
            hash: 'SHA-256',
            salt,
            info: new TextEncoder().encode(
                'PQC-Chat message encryption v1'
            )
        },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

export async function testMessageEncryption() {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveMessageKey(sharedSecret, salt);
    const message = 'PQC encryption test';

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(message)
    );

    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext
    );

    if (new TextDecoder().decode(plaintext) !== message) {
        throw new Error('AES-GCM message encryption test failed.');
    }

    console.log('AES-GCM encryption/decryption test passed.');
}

export async function encryptMessage(recipientPublicKeyBase64, message) {
    if (typeof message !== 'string' || !message.trim()) {
        throw new Error('Enter a message before sending.');
    }

    const recipientPublicKey = fromBase64(recipientPublicKeyBase64);

    if (recipientPublicKey.length !== 1184) {
        throw new Error('Recipient ML-KEM-768 public key is invalid.');
    }

    const encapsulated = ml_kem768.encapsulate(recipientPublicKey);
    const sharedSecret = new Uint8Array(encapsulated.sharedSecret);

    try {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const nonce = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveMessageKey(sharedSecret, salt);

        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce },
            key,
            new TextEncoder().encode(message)
        );

        return {
            algorithm: MESSAGE_ALGORITHM,
            kem_ciphertext: toBase64(
                new Uint8Array(encapsulated.cipherText)
            ),
            salt: toBase64(salt),
            nonce: toBase64(nonce),
            ciphertext: toBase64(new Uint8Array(encrypted))
        };
    } finally {
        sharedSecret.fill(0);
    }
}

export async function decryptMessage(secretKey, packageData) {
    if (packageData.algorithm !== MESSAGE_ALGORITHM) {
        throw new Error('Unsupported message encryption algorithm.');
    }

    const kemCiphertext = fromBase64(packageData.kem_ciphertext);
    const salt = fromBase64(packageData.salt);
    const nonce = fromBase64(packageData.nonce);
    const ciphertext = fromBase64(packageData.ciphertext);

    if (kemCiphertext.length !== 1088) {
        throw new Error('Invalid ML-KEM ciphertext length.');
    }

    if (salt.length !== 16 || nonce.length !== 12) {
        throw new Error('Invalid message encryption parameters.');
    }

    const sharedSecret = new Uint8Array(
        ml_kem768.decapsulate(kemCiphertext, secretKey)
    );

    try {
        const key = await deriveMessageKey(sharedSecret, salt);

        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: nonce },
            key,
            ciphertext
        );

        return new TextDecoder().decode(plaintext);
    } finally {
        sharedSecret.fill(0);
    }
}
