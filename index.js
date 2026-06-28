// ======================== NYONI-XMD INDEX (SQLITE FIX) ========================
const {
    default: makeWASocket,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    Browsers
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const express = require("express");
const axios = require("axios");
const Database = require('better-sqlite3');
const { randomBytes } = require('crypto');

const app = express();
const port = process.env.PORT || 10000;
let sock;
const prefix = ".";
const thumbUrl = "https://files.catbox.moe/t4ts87.jpeg";

// ========== SQLITE AUTH STORAGE (FULL) ==========
const db = new Database('./auth_state.db', { verbose: console.log });

// Create tables if they don't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS auth_creds (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_keys (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
`);

const authStore = {
    state: {
        creds: {},
        keys: {}
    },

    async saveCreds() {
        const stmt = db.prepare('INSERT OR REPLACE INTO auth_creds (key, value) VALUES (?, ?)');
        stmt.run('creds', JSON.stringify(this.state.creds));
        console.log('🔐 Auth credentials saved to SQLite');
    },

    async loadCreds() {
        const row = db.prepare('SELECT value FROM auth_creds WHERE key = ?').get('creds');
        if (row) {
            this.state.creds = JSON.parse(row.value);
            console.log('🔐 Auth credentials loaded from SQLite');
        }
        return this.state.creds;
    },

    async saveKeys() {
        const stmt = db.prepare('INSERT OR REPLACE INTO auth_keys (key, value) VALUES (?, ?)');
        for (const [key, value] of Object.entries(this.state.keys)) {
            stmt.run(key, JSON.stringify(value));
        }
        console.log('🔐 Auth keys saved to SQLite');
    },

    async loadKeys() {
        const rows = db.prepare('SELECT key, value FROM auth_keys').all();
        for (const row of rows) {
            this.state.keys[row.key] = JSON.parse(row.value);
        }
        console.log('🔐 Auth keys loaded from SQLite');
        return this.state.keys;
    },

    async clearCreds() {
        db.prepare('DELETE FROM auth_creds').run();
        db.prepare('DELETE FROM auth_keys').run();
        this.state.creds = {};
        this.state.keys = {};
        console.log('🔐 Auth data cleared');
    }
};

// ========== GLOBAL SETTINGS ==========
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

// ========== COMMAND REGISTRY (GLOBAL) ==========
global.commands = new Map();
global.aliases = new Map();
global.commandsList = [];

function registerCommand(cmd) {
    if (!cmd.command) return;
    global.commands.set(cmd.command, cmd);
    if (cmd.alias && Array.isArray(cmd.alias)) {
        cmd.alias.forEach(a => global.aliases.set(a, cmd.command));
    }
    global.commandsList.push(cmd);
    console.log(`📝 Registered: ${cmd.command}`);
}

function getCommand(name) {
    return global.commands.get(name) || global.commands.get(global.aliases.get(name));
}

global.registerCommand = registerCommand;
global.getCommand = getCommand;

// ========== PLUGIN LOADER (INAYOTUMIA COMMAND SYSTEM) ==========
function loadPlugins() {
    const pluginFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder, { recursive: true });
    
    const files = fs.readdirSync(pluginFolder).filter(file => file.endsWith('.js'));
    // Clear previous commands (but keep default ones if any)
    global.commands.clear();
    global.aliases.clear();
    global.commandsList = [];
    
    for (const file of files) {
        try {
            delete require.cache[require.resolve(`./plugins/${file}`)];
            require(`./plugins/${file}`);
            console.log(`✅ Loaded plugin: ${file}`);
        } catch (e) {
            console.error(`Error loading plugin ${file}:`, e);
        }
    }
    console.log(`✅ Total commands loaded: ${global.commandsList.length}`);
}

// ========== MENU GENERATOR (AUTO) ==========
function generateAutoMenu() {
    const categories = {};
    for (const cmd of global.commandsList) {
        const cat = cmd.category || "GENERAL";
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(cmd.command);
    }
    
    let menuText = `🚀 *NYONI-XMD AUTOMATIC MENU*\n\n`;
    for (const [category, commands] of Object.entries(categories)) {
        menuText += `*╭┈〔 💞 ${category.toUpperCase()} 〕┈─*\n`;
        commands.forEach(cmd => {
            menuText += `┃ ✧ \`${prefix}${cmd}\`\n`;
        });
        menuText += `╰──────────┈──\n\n`;
    }
    
    menuText += `📊 *SYSTEM STATUS*\n`;
    menuText += `✧ Commands: ${global.commandsList.length}\n`;
    menuText += `✧ Public: ${global.botSettings.publicMode ? '✅' : '❌'}\n`;
    menuText += `✧ Anti-Sticker: ${global.botSettings.antiSticker ? '✅' : '❌'}\n`;
    menuText += `✧ Database: SQLite ✅\n`;
    
    return menuText;
}

// ========== HELP COMMAND ==========
function generateHelp(commandName) {
    const cmd = getCommand(commandName);
    if (!cmd) return `❌ Command "${commandName}" not found!\nUse ${prefix}menu to see all available commands.`;
    
    let helpText = `╭───『 📘 𝐇𝐄𝐋𝐏: ${prefix}${cmd.command.toUpperCase()} 』\n`;
    helpText += `│\n`;
    helpText += `│ 📝 *Description:* ${cmd.desc || "No description"}\n`;
    helpText += `│ 🏷️ *Category:* ${cmd.category || "GENERAL"}\n`;
    helpText += `│ 📌 *Usage:* ${prefix}${cmd.command}\n`;
    if (cmd.alias && cmd.alias.length > 0) {
        helpText += `│ 🔤 *Aliases:* ${cmd.alias.map(a => `${prefix}${a}`).join(', ')}\n`;
    }
    helpText += `╰──────────────────────────\n`;
    return helpText;
}

// ========== ANTI-STICKER PROTECTION ==========
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

// ========== EXPRESS ROUTES ==========
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
    const pluginList = Array.from(global.commands.keys());
    res.json({ total: pluginList.length, plugins: pluginList });
});

app.get('/auth-status', (req, res) => {
    const row = db.prepare('SELECT value FROM auth_creds WHERE key = ?').get('creds');
    const hasAuth = !!row;
    res.json({ authenticated: hasAuth, usingDatabase: "SQLite" });
});

app.listen(port, () => console.log(`🚀 Server live on port ${port} (SQLite Edition)`));

// ========== BOT START ==========
async function startNyoni() {
    try {
        console.log('🔧 Initializing NYONI-XMD with full SQLite storage...');
        
        // Load credentials and keys from SQLite
        await authStore.loadCreds();
        await authStore.loadKeys();

        // Fetch Baileys version
        const { version } = await fetchLatestBaileysVersion();

        // Create socket with full key store
        sock = makeWASocket({
            version,
            auth: {
                creds: authStore.state.creds,
                keys: makeCacheableSignalKeyStore(authStore.state.keys, pino({ level: "silent" })),
            },
            printQRInTerminal: true,
            logger: pino({ level: "silent" }),
            browser: Browsers.macOS("Firefox"),
            markOnlineOnConnect: global.botSettings.alwaysOnline,
            syncFullHistory: true,
        });

        // Handle credential updates
        sock.ev.on('creds.update', async () => {
            console.log('📝 Updating credentials in SQLite...');
            await authStore.saveCreds();
            await authStore.saveKeys();
        });

        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('📱 Scan QR Code below:');
            }
            
            if (connection === 'close') {
                const reason = lastDisconnect?.error?.output?.statusCode;
                console.log(`🔌 Connection closed. Reason code: ${reason}`);
                
                if (reason !== DisconnectReason.loggedOut) {
                    console.log("🔄 Attempting to reconnect in 5 seconds...");
                    setTimeout(() => {
                        startNyoni().catch(e => console.error('Reconnection failed:', e));
                    }, 5000);
                } else {
                    console.log("❌ Logged out. Clearing credentials...");
                    await authStore.clearCreds();
                }
            } else if (connection === 'open') {
                console.log('✅ NYONI-XMD IS LIVE! (Using SQLite Storage)');
                await authStore.saveCreds();
                await authStore.saveKeys();
                
                // Load plugins after connection
                loadPlugins();
                
                // Notify owner
                const ownerJid = jidNormalizedUser(sock.user.id);
                await sock.sendMessage(ownerJid, { 
                    text: `🚀 *NYONI-XMD CONNECTED!*\n\n✅ Using SQLite for persistent storage\n✅ Automatic menu system active\n✅ Anti-sticker protection enabled\n📊 Commands loaded: ${global.commandsList.length}`
                });
            }
        });

        // Message handler
        sock.ev.on('messages.upsert', async (m) => {
            const msg = m.messages[0];
            if (!msg.message) return;

            const from = msg.key.remoteJid;
            const isGroup = from.endsWith('@g.us');
            const senderJid = msg.key.participant || msg.key.remoteJid;

            // Anti-sticker check
            if (isGroup && msg.message.stickerMessage && global.botSettings.antiSticker) {
                if (!checkStickerPermission(from, senderJid)) {
                    await handleStickerViolation(sock, msg, from, senderJid);
                    return;
                }
            }

            // Auto status view/react
            if (from === 'status@broadcast') {
                if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
                if (global.botSettings.autoStatusReact) {
                    await sock.sendMessage(from, { 
                        react: { text: global.botSettings.statusEmoji, key: msg.key } 
                    }, { statusJidList: [msg.key.participant] });
                }
                return;
            }

            // Check if message is a command
            const body = (msg.message.conversation || 
                         msg.message.extendedTextMessage?.text || 
                         msg.message.imageMessage?.caption || 
                         msg.message.videoMessage?.caption || "").trim();
            const isCmd = body.startsWith(prefix);
            const commandName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
            const args = body.trim().split(/ +/).slice(1);

            if (isCmd) {
                if (!global.botSettings.publicMode && !msg.key.fromMe) return;

                // Auto react and typing
                await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
                if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);

                // Menu command
                if (commandName === 'menu' || (commandName === 'help' && args.length === 0)) {
                    const menuText = generateAutoMenu();
                    return await sock.sendMessage(from, { 
                        image: { url: thumbUrl }, 
                        caption: menuText 
                    }, { quoted: msg });
                }
                
                // Help for specific command
                if (commandName === 'help' && args[0]) {
                    const helpText = generateHelp(args[0].toLowerCase());
                    return await sock.sendMessage(from, { text: helpText }, { quoted: msg });
                }
                
                // Execute command from plugin
                const cmd = getCommand(commandName);
                if (cmd) {
                    try {
                        await cmd.function(sock, msg, { 
                            from, args, isGroup, sender: senderJid, 
                            prefix, isOwner: msg.key.fromMe 
                        });
                    } catch (err) {
                        console.error(`Error in command ${commandName}:`, err);
                        await sock.sendMessage(from, { 
                            text: `❌ Error executing ${prefix}${commandName}\nError: ${err.message || 'Unknown error'}` 
                        }, { quoted: msg });
                    }
                } else {
                    await sock.sendMessage(from, { 
                        text: `❌ Command "${commandName}" not found!\nUse ${prefix}menu to see all available commands.`
                    }, { quoted: msg });
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
