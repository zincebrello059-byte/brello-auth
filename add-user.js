const fs = require('fs');
const path = require('path');

// Einfaches CLI-Tool zum Hinzufügen von Benutzern
function addUser() {
    const DB_FILE = path.join(__dirname, 'database.json');
    
    console.log('\n=== Benutzer hinzufügen ===\n');
    
    // Argumente aus Kommandozeile lesen
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Verwendung: node add-user.js <DiscordID> <Username> [Produktname]');
        console.log('\nBeispiel:');
        console.log('  node add-user.js 123456789012345678 TestUser');
        console.log('  node add-user.js 123456789012345678 TestUser "Fivem Client"');
        process.exit(1);
    }
    
    const discordId = args[0];
    const username = args[1];
    const productName = args[2] || 'Fivem Client';
    
    // Datenbank laden
    let db;
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        db = JSON.parse(data);
    } catch (error) {
        console.error('Fehler beim Laden der Datenbank:', error.message);
        process.exit(1);
    }
    
    // Prüfen ob Benutzer bereits existiert
    const existingUser = db.users.find(u => u.discordId === discordId);
    if (existingUser) {
        console.log(`\n⚠️  Benutzer mit DiscordID ${discordId} existiert bereits!`);
        console.log(`   Username: ${existingUser.username}`);
        console.log(`   Produkte: ${existingUser.products.map(p => p.name).join(', ')}`);
        
        // Produkt hinzufügen falls noch nicht vorhanden
        const hasProduct = existingUser.products.some(p => p.name === productName);
        if (!hasProduct) {
            existingUser.products.push({
                name: productName,
                expiry: '2099-12-31'
            });
            console.log(`\n✅ Produkt "${productName}" wurde hinzugefügt!`);
        } else {
            console.log(`\nℹ️  Produkt "${productName}" existiert bereits.`);
        }
    } else {
        // Neuen Benutzer erstellen
        const newUser = {
            discordId: discordId,
            username: username,
            hwid: '',
            products: [
                {
                    name: productName,
                    expiry: '2099-12-31'
                }
            ]
        };
        
        db.users.push(newUser);
        console.log(`\n✅ Benutzer wurde hinzugefügt!`);
    }
    
    // Statistiken aktualisieren
    db.config.statistics.user = db.users.length;
    db.config.statistics.products = db.users.reduce((total, user) => total + (user.products ? user.products.length : 0), 0);
    
    // Speichern
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        console.log('\n📝 Datenbank wurde aktualisiert.');
        console.log(`\nBenutzer-Info:`);
        console.log(`  DiscordID: ${discordId}`);
        console.log(`  Username: ${username}`);
        console.log(`  Produkt: ${productName}`);
        console.log('\n');
    } catch (error) {
        console.error('Fehler beim Speichern:', error.message);
        process.exit(1);
    }
}

addUser();

