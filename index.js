const {
    default: makeWASocket,
    useMultiFileAuthState,
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

const app = express();
const port = process.env.PORT || 10000;
let sock;
const prefix = ".";
const thumbUrl = "https://files.catbox.moe/t4ts87.jpeg";

// Global Settings
global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,
    autoStatus: true,
    autoStatusReact: true,
    statusEmoji: "🫡",
    myUrl: "https://nyoni-md-free.onrender.com",
    antiSticker: true,
    stickerWarning: true,
    stickerTimeout: 5 * 60 * 1000,
    stickerBannedGroups: []
};

// --- FIXED PLUGIN LOADER ---
const plugins = new Map();
function loadPlugins() {
    const pluginFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder);
    
    const files = fs.readdirSync(pluginFolder).filter(file => file.endsWith('.js'));
    plugins.clear();
    
    for (const file of files) {
        try {
            const pluginPath = path.join(pluginFolder, file);
            // Kufuta cache ili hot-reload ifanye kazi vizuri
            delete require.cache[require.resolve(pluginPath)];
            const command = require(pluginPath);
            
            // Jina la command lichukuliwe kwenye file au jina la file lenyewe
            const cmdName = command.name || file.replace('.js', '');
            
            plugins.set(cmdName, {
                ...command,
                name: cmdName,
                category: command.category || "OTHERS" // Default category
            });
        } catch (e) {
            console.error(`❌ Error loading plugin ${file}:`, e);
        }
    }
    console.log(`✅ Loaded ${plugins.size} plugins successfully!`);
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
        let action = warnings >= 3 ? `⏳ Muted for ${global.botSettings.stickerTimeout / 60000} mins` : "";
        
        const warningMsg = `⚠️ *STICKER NOT ALLOWED*\n\n` +
                          `👤 User: @${senderJid.split('@')[0]}\n` +
                          `🚫 Warning: ${warnings}/3\n` +
                          `${action}`;
        
        await sock.sendMessage(from, { text: warningMsg, mentions: [senderJid] }, { quoted: msg });
    }
    await sock.sendMessage(from, { delete: msg.key });
}

// --- EXPRESS SETUP ---
app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));
app.listen(port, () => console.log(`Server live on port ${port}`));

async function startNyoni() {
    loadPlugins();
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: true,
        logger: pino({ level: "silent" }),
        browser: ["Nyoni-XMD", "Safari", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startNyoni();
        } else if (connection === 'open') {
            console.log('✅ CONNECTED TO WHATSAPP');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const senderJid = isGroup ? msg.key.participant : from;
        const isOwner = msg.key.fromMe || global.botSettings.myUrl.includes(senderJid.split('@')[0]);

        // Anti-Sticker Logic
        if (isGroup && msg.message.stickerMessage && global.botSettings.antiSticker && !isOwner) {
            if (!checkStickerPermission(from, senderJid)) {
                return await handleStickerViolation(sock, msg, from, senderJid);
            }
        }

        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isCmd = body.startsWith(prefix);
        const commandName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);

        if (isCmd) {
            if (!global.botSettings.publicMode && !isOwner) return;

            // --- FIXED AUTOMATIC MENU ---
            if (commandName === 'menu' || commandName === 'help') {
                const categories = {};
                
                // Kupanga plugins kwenye kundi (Categories)
                plugins.forEach(p => {
                    const cat = p.category.toUpperCase();
                    if (!categories[cat]) categories[cat] = [];
                    categories[cat].push(p.name);
                });

                let menuText = `🚀 *NYONI-XMD BOT*\n\n`;
                menuText += `*Prefix:* ${prefix}\n`;
                menuText += `*Mode:* ${global.botSettings.publicMode ? 'Public' : 'Self'}\n`;
                menuText += `*Total Commands:* ${plugins.size}\n\n`;

                // Kupanga menu kulingana na category majina ya herufi (A-Z)
                const sortedCategories = Object.keys(categories).sort();
                
                for (const cat of sortedCategories) {
                    menuText += `*╭┈〔 🌟 ${cat} 〕┈─*\n`;
                    categories[cat].sort().forEach(cmd => {
                        menuText += `┃ ✧ ${prefix}${cmd}\n`;
                    });
                    menuText += `╰──────────┈\n\n`;
                }

                menuText += `_Regard Nyoni-XMD_`;

                return await sock.sendMessage(from, { 
                    image: { url: thumbUrl }, 
                    caption: menuText 
                }, { quoted: msg });
            }

            // Plugin Execution logic
            const plugin = plugins.get(commandName);
            if (plugin) {
                try {
                    await plugin.execute(sock, from, msg, args);
                } catch (err) {
                    console.error(err);
                    await sock.sendMessage(from, { text: "❌ Error executing command." });
                }
            }
        }
    });
}

startNyoni();
