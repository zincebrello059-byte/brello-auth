const crypto = require('crypto');

// AES-Verschlüsselungsparameter (müssen mit dem C++ Code übereinstimmen)
const AES_KEY = '9Q8D166Yq9RW88c24jAmwb3luf4Mdg78';
const AES_IV = 'FXkjAXD3R2H5L9cB';

/**
 * Verschlüsselt einen String mit AES-256-CBC (kompatibel mit C++ Code)
 */
function encryptData(input) {
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(AES_KEY), Buffer.from(AES_IV));
    let encrypted = cipher.update(input, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

/**
 * Entschlüsselt einen String mit AES-256-CBC
 */
function decryptData(encryptedHex) {
    try {
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(AES_KEY), Buffer.from(AES_IV));
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

/**
 * Base64-Decodierung (für eingehende Daten)
 */
function base64Decode(base64String) {
    return Buffer.from(base64String, 'base64').toString('utf8');
}

module.exports = {
    encryptData,
    decryptData,
    base64Decode
};

