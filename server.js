const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { decryptData, base64Decode } = require('./crypto-utils');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statische Dateien (Website) - Falls public/ Ordner existiert
if (fs.existsSync(path.join(__dirname, 'public'))) {
    app.use(express.static(path.join(__dirname, 'public')));
}

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Multer für multipart/form-data
const upload = multer();

// Datenbank-Datei
const DB_FILE = path.join(__dirname, 'database.json');

// Session-Speicher (in Produktion sollte das eine Datenbank sein)
const activeSessions = new Map();

// Hilfsfunktion zum Laden der Datenbank
function loadDatabase() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading database:', error);
        return { users: [], config: { version: '1.0.0', statistics: { user: 0, products: 0 } } };
    }
}

// Hilfsfunktion zum Speichern der Datenbank
function saveDatabase(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving database:', error);
        return false;
    }
}

// Endpoint: /api/loader/initialize
app.post('/api/loader/initialize', upload.fields([]), (req, res) => {
    try {
        const version = req.body.version || '1.0.0';
        const db = loadDatabase();

        // Antwort mit Config und Statistiken
        const response = {
            message: 'Initialized successfully',
            config: {
                version: db.config.version || version,
                statistics: {
                    user: db.users.length,
                    products: db.users.reduce((total, user) => total + (user.products ? user.products.length : 0), 0)
                }
            }
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Initialize error:', error);
        res.status(500).json({
            message: 'Failed to initialize',
            error: error.message
        });
    }
});

// Endpoint: /api/loader/login (vereinfacht für Website)
app.post('/api/loader/login', upload.fields([]), (req, res) => {
    try {
        let discordId = req.body.discordID;
        let hwid = req.body.hwid;

        // Prüfe ob Daten verschlüsselt sind (vom C++ Client) oder unverschlüsselt (von Website)
        if (!discordId || !hwid) {
            return res.status(400).json({
                message: 'Missing required fields (discordID or hwid)'
            });
        }

        // Versuche zu entschlüsseln (wenn vom C++ Client)
        // Wenn Entschlüsselung fehlschlägt, sind die Daten bereits unverschlüsselt (von Website)
        try {
            const encryptedDiscordIdHex = base64Decode(discordId);
            const encryptedHwidHex = base64Decode(hwid);
            
            const decryptedDiscordId = decryptData(encryptedDiscordIdHex);
            const decryptedHwid = decryptData(encryptedHwidHex);
            
            if (decryptedDiscordId && decryptedHwid) {
                discordId = decryptedDiscordId;
                hwid = decryptedHwid;
            }
        } catch (e) {
            // Daten sind bereits unverschlüsselt (von Website) - verwende direkt
            console.log('Login with unencrypted data (from website)');
        }

        console.log(`Login attempt - DiscordID: ${discordId}, HWID: ${hwid}`);

        // Datenbank laden
        const db = loadDatabase();

        // Benutzer finden
        let user = db.users.find(u => u.discordId === discordId);

        if (!user) {
            // Neuer Benutzer - optional: automatisch erstellen oder ablehnen
            return res.status(401).json({
                message: 'User not found. Please register first.'
            });
        }

        // HWID-Prüfung (optional - kann auch deaktiviert werden)
        if (user.hwid && user.hwid !== hwid) {
            console.log(`HWID mismatch for user ${discordId}`);
            // Optional: HWID aktualisieren oder ablehnen
            // user.hwid = hwid; // HWID aktualisieren
        } else if (!user.hwid) {
            // Erste Anmeldung - HWID speichern
            user.hwid = hwid;
            saveDatabase(db);
        }

        // Produkte für Antwort formatieren
        const products = (user.products || []).map(p => ({
            name: p.name,
            expiry: p.expiry || '2099-12-31'
        }));

        // Session-Token generieren (einfach für jetzt)
        const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        activeSessions.set(sessionToken, {
            discordId: discordId,
            loginTime: Date.now(),
            status: 'logged_in'
        });

        // Erfolgreiche Antwort
        const response = {
            message: 'Login successful',
            user: {
                username: user.username || 'User',
                DiscordID: user.discordId,
                hwid: user.hwid,
                products: products
            },
            sessionToken: sessionToken
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Login failed',
            error: error.message
        });
    }
});

// Endpoint: /api/loader/load - Startet das Programm/Injiziert das Menü
app.post('/api/loader/load', upload.fields([]), (req, res) => {
    try {
        const sessionToken = req.body.sessionToken || req.headers['x-session-token'];
        
        if (!sessionToken || !activeSessions.has(sessionToken)) {
            return res.status(401).json({
                message: 'Invalid or expired session. Please login again.'
            });
        }

        const session = activeSessions.get(sessionToken);
        
        // Update Session Status
        session.status = 'loaded';
        session.loadTime = Date.now();
        activeSessions.set(sessionToken, session);

        console.log(`Load triggered for user: ${session.discordId}`);

        // Antwort mit Download-Link oder Status
        const response = {
            message: 'Load successful. Program is ready to inject.',
            status: 'loaded',
            downloadUrl: '/download/loader.exe', // Falls du eine .exe zum Download anbietest
            instructions: 'Start the program and it will automatically inject into FiveM.'
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Load error:', error);
        res.status(500).json({
            message: 'Load failed',
            error: error.message
        });
    }
});

// Endpoint: /api/loader/destruct - Entlädt das Programm/Cleaned alles
app.post('/api/loader/destruct', upload.fields([]), (req, res) => {
    try {
        const sessionToken = req.body.sessionToken || req.headers['x-session-token'];
        
        if (!sessionToken || !activeSessions.has(sessionToken)) {
            return res.status(401).json({
                message: 'Invalid or expired session. Please login again.'
            });
        }

        const session = activeSessions.get(sessionToken);
        
        // Update Session Status
        session.status = 'destructed';
        session.destructTime = Date.now();
        activeSessions.set(sessionToken, session);

        console.log(`Destruct triggered for user: ${session.discordId}`);

        // Nach Destruct: Session löschen (Logout)
        setTimeout(() => {
            activeSessions.delete(sessionToken);
        }, 5000);

        const response = {
            message: 'Destruct successful. Program has been unloaded and cleaned.',
            status: 'destructed'
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Destruct error:', error);
        res.status(500).json({
            message: 'Destruct failed',
            error: error.message
        });
    }
});

// Health Check Endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root Endpoint - Website anzeigen
app.get('/', (req, res) => {
    // Prüfe ob HTML-Datei existiert (erst public/, dann root)
    const htmlInPublic = path.join(__dirname, 'public', 'index.html');
    const htmlInRoot = path.join(__dirname, 'index.html');
    
    if (fs.existsSync(htmlInPublic)) {
        res.sendFile(htmlInPublic);
    } else if (fs.existsSync(htmlInRoot)) {
        res.sendFile(htmlInRoot);
    } else {
        // Fallback: JSON API Info
        res.json({
            message: 'XRC Authentication Server',
            endpoints: {
                initialize: 'POST /api/loader/initialize',
                login: 'POST /api/loader/login',
                load: 'POST /api/loader/load',
                destruct: 'POST /api/loader/destruct',
                health: 'GET /health'
            },
            note: 'HTML website not found. Please add index.html to the repository.'
        });
    }
});

// API Info Endpoint
app.get('/api', (req, res) => {
    res.json({
        message: 'XRC Authentication Server',
        endpoints: {
            initialize: 'POST /api/loader/initialize',
            login: 'POST /api/loader/login',
            load: 'POST /api/loader/load',
            destruct: 'POST /api/loader/destruct',
            health: 'GET /health'
        }
    });
});

// Server starten
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`XRC Authentication Server gestartet!`);
    console.log(`Server läuft auf: http://localhost:${PORT}`);
    console.log(`========================================\n`);
    
    // Datenbank prüfen/erstellen
    if (!fs.existsSync(DB_FILE)) {
        const defaultDb = {
            users: [],
            config: {
                version: '1.0.0',
                statistics: { user: 0, products: 0 }
            }
        };
        saveDatabase(defaultDb);
        console.log('Datenbank-Datei erstellt.');
    }
    
    console.log('Bereit für Anfragen!\n');
});
