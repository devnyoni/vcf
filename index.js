const {
    default: makeWASocket,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    jidNormalizedUser
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const express = require("express");
const axios = require("axios");
const Database = require('better-sqlite3'); // <<< REKEDEBISHA 1: IMPORT SQLITE

const app = express();
const port = process.env.PORT || 10000;
let sock;
const prefix = ".";
const thumbUrl = "https://files.catbox.moe/t4ts87.jpeg";

// REKEDEBISHA 2: UNDA HIFADHI YA SQLITE KWA UMILIKI
const db = new Database('./auth_state.db', { verbose: console.log });

// Hakikisha jedwali lipo
db.exec(`
    CREATE TABLE IF NOT EXISTS auth_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
`);

const authStore = {
    state: {
        creds: {},
        keys: {}
    },

    async saveCreds() {
        const stmt = db.prepare('INSERT OR REPLACE INTO auth_state (key, value) VALUES (?, ?)');
        stmt.run('creds', JSON.stringify(this.state.creds));
        console.log('🔐 Auth credentials saved to SQLite');
    },

    async loadCreds() {
        const row = db.prepare('SELECT value FROM auth_state WHERE key = ?').get('creds');
        if (row) {
            this.state.creds = JSON.parse(row.value);
            console.log('🔐 Auth credentials loaded from SQLite');
        }
        return this.state.creds;
    },

    async clearCreds() {
        db.prepare('DELETE FROM auth_state WHERE key = ?').run('creds');
        this.state.creds = {};
        console.log('🔐 Auth credentials cleared');
    }
};

// Global Settings
global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,
    autoStatus: true,
    autoStatusReact: true,
    statusEmoji: "🫡",
    myUrl: process.env.APP_URL || "https://nyoni-md-free.onrender.com",
    antiSticker: true,
    stickerWarning: true,
    stickerTimeout: 5 * 60 * 1000,
    stickerBannedGroups: []
};

// --- PLUGIN LOADER ---
const plugins = new Map();
const pluginDescriptions = new Map();

function loadPlugins() {
    const pluginFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder, { recursive: true });
    
    const files = fs.readdirSync(pluginFolder).filter(file => file.endsWith('.js'));
    plugins.clear();
    pluginDescriptions.clear();
    
    for (const file of files) {
        try {
            delete require.cache[require.resolve(`./plugins/${file}`)];
            const command = require(`./plugins/${file}`);
            
            if (command.name) {
                plugins.set(command.name, command);
                pluginDescriptions.set(command.name, {
                    description: command.description || "No description",
                    category: command.category || "GENERAL",
                    usage: command.usage || command.name
                });
            }
        } catch (e) {
            console.error(`Error loading plugin ${file}:`, e);
        }
    }
    console.log(`✅ Loaded ${plugins.size} plugins automatically!`);
}

// --- AUTOMATIC MENU GENERATOR (UREMBO MPYA) ---
function generateAutoMenu() {
    const categories = {};
    
    pluginDescriptions.forEach((info, name) => {
        const cat = info.category;
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(name);
    });
    
    let menuText = `🚀 *NYONI-XMD AUTOMATIC MENU*\n\n`;
    
    for (const [category, commands] of Object.entries(categories)) {
        menuText += `*╭┈〔 💞 ${category.toUpperCase()} 〕┈─*\n`;
        commands.forEach(cmd => {
            menuText += `┃ ✧ \`${prefix}${cmd}\`\n`;
        });
        menuText += `╰──────────┈──\n\n`;
    }
    
    menuText += `📊 *SYSTEM STATUS*\n`;
    menuText += `✧ Plugins: ${plugins.size}\n`;
    menuText += `✧ Public: ${global.botSettings.publicMode ? '✅' : '❌'}\n`;
    menuText += `✧ Anti-Sticker: ${global.botSettings.antiSticker ? '✅' : '❌'}\n`;
    menuText += `✧ Database: SQLite ✅\n`;
    
    return menuText;
}

// --- HELP COMMAND GENERATOR ---
function generateHelp(commandName) {
    if (!plugins.has(commandName)) {
        return `❌ Command "${commandName}" not found!\nUse ${prefix}menu to see all available commands.`;
    }
    
    const command = plugins.get(commandName);
    const info = pluginDescriptions.get(commandName);
    
    let helpText = `╭───『 📘 𝐇𝐄𝐋𝐏: ${prefix}${commandName.toUpperCase()} 』\n`;
    helpText += `│\n`;
    helpText += `│ 📝 *Description:* ${info.description}\n`;
    helpText += `│ 🏷️ *Category:* ${info.category}\n`;
    helpText += `│ 📌 *Usage:* ${prefix}${info.usage}\n`;
    
    if (command.examples) {
        helpText += `│\n│ 📚 *Examples:*\n`;
        command.examples.forEach(example => {
            helpText += `│   └─ ${prefix}${example}\n`;
        });
    }
    
    if (command.aliases && command.aliases.length > 0) {
        helpText += `│\n│ 🔤 *Aliases:* ${command.aliases.map(a => `${prefix}${a}`).join(', ')}\n`;
    }
    
    helpText += `╰──────────────────────────\n`;
    
    return helpText;
}

// --- STICKER PROTECTION SYSTEM ---
const stickerViolations = new Map();

function checkStickerPermission(groupJid, userJid) {
    if (!global.botSettings.antiSticker) return true;
    if (global.botSettings.stickerBannedGroups.includes(groupJid)) return false;
    
    const violations = stickerViolations.get(userJid);
    if (violations && Date.now() - violations.lastViolation < global.botSettings.stickerTimeout) {
        return false;
    }
    return true;
}

async function handleStickerViolation(sock, msg, from, senderJid) {
    const violations = stickerViolations.get(senderJid) || { count: 0, lastViolation: 0 };
    violations.count++;
    violations.lastViolation = Date.now();
    stickerViolations.set(senderJid, violations);
    
    if (global.botSettings.stickerWarning) {
        const warnings = violations.count;
        let action = warnings >= 3 ? `⏳ Muted for ${global.botSettings.stickerTimeout / (60 * 1000)} minutes` : "";
        
        const warningMsg = `⚠️ *STICKER WARNING*\n\nUser: @${senderJid.split('@')[0]}\nWarning #${warnings}\n${action}`;
        await sock.sendMessage(from, { text: warningMsg, mentions: [senderJid] }, { quoted: msg });
    }
    try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
}

// --- EXPRESS ROUTES ---
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀 - SQLite Edition"));

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Enter number! Example: /code?number=255xxxxxxxxx");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock || !sock.user) {
            return res.status(500).json({ error: "Bot is connecting. Please wait 15 seconds." });
        }
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { 
        console.error("Pairing error:", err);
        res.status(500).json({ error: "WhatsApp Error or Wrong Number." }); 
    }
});

app.get('/plugins', (req, res) => {
    const pluginList = Array.from(plugins.keys());
    res.json({ total: plugins.size, plugins: pluginList });
});

app.get('/auth-status', (req, res) => {
    const row = db.prepare('SELECT value FROM auth_state WHERE key = ?').get('creds');
    const hasAuth = !!row;
    res.json({ authenticated: hasAuth, usingDatabase: "SQLite" });
});

app.listen(port, () => console.log(`🚀 Server live on port ${port} (SQLite Edition)`));

// --- REKEDEBISHA 3: START BOTI KWA SQLITE ---
async function startNyoni() {
    try {
        console.log('🔧 Initializing NYONI-XMD with SQLite storage...');
        loadPlugins();
        
        // 1. PATA CREDS KUTOKA SQLITE
        await authStore.loadCreds();
        
        // 2. PAKUA VERSION YA BAILEYS
        const { version } = await fetchLatestBaileysVersion();
        
        // 3. UNDA SOCKET
        sock = makeWASocket({
            version,
            auth: {
                creds: authStore.state.creds,
                keys: makeCacheableSignalKeyStore({}, pino({ level: "silent" })), // Keys tupu kwani hazi-hifadhiwi
            },
            printQRInTerminal: true, // Weka true kwa ajili ya debugging
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            markOnlineOnConnect: true
        });

        // 4. WEKA CREDS UPDATE HANDLER
        sock.ev.on('creds.update', async () => {
            console.log('📝 Updating credentials in SQLite...');
            await authStore.saveCreds();
        });

        // 5. WEKA CONNECTION UPDATE HANDLER
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            // Display QR Code kama ipo
            if (qr) {
                console.log('📱 Scan QR Code below:');
                // QR itaonekana kwenye terminal kwa sababu printQRInTerminal = true
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`🔌 Connection closed. Reason code: ${reason}`);
                
                if (reason !== DisconnectReason.loggedOut) {
                    console.log("🔄 Attempting to reconnect in 5 seconds...");
                    setTimeout(() => {
                        console.log('🔄 Starting reconnection...');
                        startNyoni().catch(e => console.error('Reconnection failed:', e));
                    }, 5000);
                } else {
                    console.log("❌ Logged out. Clearing credentials...");
                    await authStore.clearCreds();
                }
            } else if (connection === 'open') {
                console.log('✅ NYONI-XMD IS LIVE! (Using SQLite Storage)');
                
                // Save credentials immediately after connection
                await authStore.saveCreds();
                
                // Notify owner
                const ownerJid = jidNormalizedUser(sock.user.id);
                await sock.sendMessage(ownerJid, { 
                    text: "🚀 *NYONI-XMD CONNECTED!*\n\n" +
                          "✅ Using SQLite for persistent storage\n" +
                          "✅ Automatic menu system active\n" +
                          "✅ Anti-sticker protection enabled\n" +
                          `📊 Plugins loaded: ${plugins.size}`
                });
            }
        });

        // 6. WEKA MESSAGE HANDLER
        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            
            // Anti-sticker check
            if (isGroup && msg.message.stickerMessage && global.botSettings.antiSticker) {
                const senderJid = msg.key.participant || msg.key.remoteJid;
                if (!checkStickerPermission(from, senderJid)) {
                    await handleStickerViolation(sock, msg, from, senderJid);
                    return;
                }
            }

            // Status auto-view/react
            if (from === 'status@broadcast') {
                if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
                if (global.botSettings.autoStatusReact) {
                    await sock.sendMessage(from, { 
                        react: { text: global.botSettings.statusEmoji, key: msg.key } 
                    }, { statusJidList: [msg.key.participant] });
                }
                return;
            }

            const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
            const body = (msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption || 
                         msg.message.videoMessage?.caption || "").trim();
            const isCmd = body.startsWith(prefix);
            const commandName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
            const args = body.trim().split(/ +/).slice(1);

            if (isCmd) {
                if (!global.botSettings.publicMode && !isOwner) return;

                // Auto react
                await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
                if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);

                // Menu command
                if (commandName === 'menu' || (commandName === 'help' && !args[0])) {
                    loadPlugins(); // Reload plugins for fresh menu
                    const menuText = generateAutoMenu();
                    return await sock.sendMessage(from, { 
                        image: { url: thumbUrl }, 
                        caption: menuText 
                    }, { quoted: msg });
                }
                
                // Help for specific command
                if (commandName === 'help' && args[0]) {
                    return await sock.sendMessage(from, { 
                        text: generateHelp(args[0].toLowerCase()) 
                    }, { quoted: msg });
                }
                
                // Plugin command handler
                const plugin = plugins.get(commandName);
                if (plugin) {
                    try {
                        await plugin.execute(sock, from, msg, args);
                    } catch (err) {
                        console.error(`Error in plugin ${commandName}:`, err);
                        await sock.sendMessage(from, { 
                            text: `❌ Error executing ${prefix}${commandName}\nError: ${err.message || 'Unknown error'}` 
                        });
                    }
                } else if (isCmd) {
                    await sock.sendMessage(from, { 
                        text: `❌ Command "${commandName}" not found!\nUse ${prefix}menu to see all available commands.`
                    });
                }
            }
        });

        console.log('🤖 Bot initialization complete. Waiting for connection...');

    } catch (error) {
        console.error('❌ CRITICAL ERROR during bot startup:', error);
        console.log('🔄 Attempting restart in 10 seconds...');
        setTimeout(() => {
            startNyoni().catch(e => console.error('Restart failed:', e));
        }, 10000);
    }
}

// Keep-alive ping
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 2 * 60 * 1000);

// Start the bot
startNyoni();
            
