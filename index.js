const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    downloadMediaMessage
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const express = require("express");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 10000;
let sock;

// GLOBAL SETTINGS
global.prefix = "."; 
global.thumbUrl = "https://files.catbox.moe/t4ts87.jpeg";
global.botSettings = {
    publicMode: true,
    autoType: true,
    autoStatus: true,
    autoStatusReact: true,
    statusEmoji: "🫡",
    myUrl: "https://nyoni-md-free.onrender.com", // Update with your Render URL
    antiSticker: true, // Anti-sticker feature
    allowedStickerPacks: ["nyoni", "bot"], // Allowed sticker pack names
    maxStickerSize: 10000 // Maximum sticker size in KB
};

// --- PLUGIN LOADER ---
const plugins = new Map();
function loadPlugins() {
    const pluginFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder);
    const files = fs.readdirSync(pluginFolder).filter(file => file.endsWith('.js'));
    plugins.clear();
    for (const file of files) {
        try {
            delete require.cache[require.resolve(`./plugins/${file}`)];
            const command = require(`./plugins/${file}`);
            if (command.name) plugins.set(command.name, command);
        } catch (e) { console.error(`Error loading ${file}:`, e); }
    }
}

// --- ANTISTICKER FUNCTION ---
async function handleAntiSticker(sock, msg, from) {
    if (!global.botSettings.antiSticker) return false;
    
    const sticker = msg.message?.stickerMessage;
    if (!sticker) return false;
    
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = msg.key.fromMe || sender.split('@')[0] === sock.user.id.split(':')[0];
    const isGroup = from.endsWith('@g.us');
    
    // Allow owner to send stickers
    if (isOwner) return false;
    
    const stickerPack = sticker.stickerSentTs?.toString() || "unknown";
    const stickerSize = sticker.fileLength || 0;
    
    let shouldDelete = false;
    let reason = "";
    
    // Check sticker size
    if (stickerSize > global.botSettings.maxStickerSize * 1024) {
        shouldDelete = true;
        reason = `Sticker too large (${Math.round(stickerSize/1024)}KB)`;
    }
    
    // Check if sticker pack is allowed
    const isAllowed = global.botSettings.allowedStickerPacks.some(pack => 
        stickerPack.toLowerCase().includes(pack.toLowerCase())
    );
    
    if (!isAllowed) {
        shouldDelete = true;
        reason = `Sticker from unauthorized pack: ${stickerPack}`;
    }
    
    // Delete sticker if needed
    if (shouldDelete) {
        try {
            // Delete the sticker
            await sock.sendMessage(from, {
                delete: msg.key
            });
            
            // Notify in group or privately
            const warningMsg = `⚠️ *STICKER REMOVED*\nReason: ${reason}\nSender: @${sender.split('@')[0]}`;
            
            if (isGroup) {
                await sock.sendMessage(from, {
                    text: warningMsg,
                    mentions: [sender]
                });
            } else {
                await sock.sendMessage(from, {
                    text: `⚠️ Sticker removed. ${reason}`
                });
            }
            
            // Log the action
            console.log(`Anti-sticker: Deleted sticker from ${sender} - ${reason}`);
            
            return true;
        } catch (error) {
            console.error("Anti-sticker error:", error);
        }
    }
    
    return false;
}

app.get('/', (req, res) => res.send("NYONI-XMD ACTIVE 🚀"));
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Provide number!");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock) return res.status(500).json({ error: "Initializing..." });
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { res.status(500).json({ error: "WA Error" }); }
});

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
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startNyoni(), 5000);
            }
        } else if (connection === 'open') {
            const ownerJid = jidNormalizedUser(sock.user.id);
            await sock.sendMessage(ownerJid, { text: "🚀 *NYONI-XMD CONNECTED!*\n\nAnti-Sticker: " + (global.botSettings.antiSticker ? "✅ ON" : "❌ OFF") });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        const from = msg.key.remoteJid;
        
        // Handle status updates
        if (msg.key.remoteJid === 'status@broadcast') {
            if (global.botSettings.autoStatus) {
                await sock.readMessages([msg.key]);
                if (global.botSettings.autoStatusReact) {
                    await sock.sendMessage(msg.key.remoteJid, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
                }
            }
            return;
        }

        if (!msg.message) return;

        // Check for stickers first
        const hasSticker = msg.message.stickerMessage;
        if (hasSticker && global.botSettings.antiSticker) {
            const wasDeleted = await handleAntiSticker(sock, msg, from);
            if (wasDeleted) return; // Skip further processing if sticker was deleted
        }

        const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
        
        if (!body.startsWith(global.prefix)) return;

        const commandName = body.slice(global.prefix.length).trim().split(' ')[0].toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        if (!global.botSettings.publicMode && !isOwner) return;

        // Auto React & Typing
        await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);

        // --- AUTOMATIC MENU ---
        if (commandName === 'menu') {
            const categories = {};
            plugins.forEach(p => {
                const cat = p.category || "MAIN";
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(p.name);
            });

            let menuText = `🚀 *NYONI-XMD DASHBOARD*\n\n`;
            menuText += `• Prefix: ${global.prefix}\n`;
            menuText += `• Mode: ${global.botSettings.publicMode ? "Public" : "Private"}\n`;
            menuText += `• Anti-Sticker: ${global.botSettings.antiSticker ? "✅ ON" : "❌ OFF"}\n\n`;
            
            for (const [cat, cmds] of Object.entries(categories)) {
                menuText += `*╭┈〔 🏠 ${cat.toUpperCase()} 〕┈─*\n`;
                cmds.forEach(cmd => { menuText += `┃ ✧ ${global.prefix}${cmd}\n`; });
                menuText += `╰──────────┈\n\n`;
            }

            menuText += `\n⚙️ *SETTINGS*\n`;
            menuText += `${global.prefix}antisticker on/off\n`;
            menuText += `${global.prefix}public on/off\n`;

            return await sock.sendMessage(from, { image: { url: global.thumbUrl }, caption: menuText }, { quoted: msg });
        }

        // --- ANTISTICKER COMMAND ---
        if (commandName === 'antisticker') {
            if (!isOwner) return;
            const action = args[0]?.toLowerCase();
            if (action === 'on') {
                global.botSettings.antiSticker = true;
                await sock.sendMessage(from, { text: "✅ Anti-sticker feature ENABLED" }, { quoted: msg });
            } else if (action === 'off') {
                global.botSettings.antiSticker = false;
                await sock.sendMessage(from, { text: "❌ Anti-sticker feature DISABLED" }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `Anti-sticker: ${global.botSettings.antiSticker ? "✅ ON" : "❌ OFF"}` }, { quoted: msg });
            }
            return;
        }

        // --- PUBLIC MODE COMMAND ---
        if (commandName === 'public') {
            if (!isOwner) return;
            const action = args[0]?.toLowerCase();
            if (action === 'on') {
                global.botSettings.publicMode = true;
                await sock.sendMessage(from, { text: "✅ Bot is now PUBLIC" }, { quoted: msg });
            } else if (action === 'off') {
                global.botSettings.publicMode = false;
                await sock.sendMessage(from, { text: "🔒 Bot is now PRIVATE" }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `Public mode: ${global.botSettings.publicMode ? "✅ ON" : "🔒 OFF"}` }, { quoted: msg });
            }
            return;
        }

        const plugin = plugins.get(commandName);
        if (plugin) {
            try { await plugin.execute(sock, from, msg, args); } 
            catch (err) { console.error(err); }
        }
    });
}

setInterval(() => { axios.get(global.botSettings.myUrl).catch(() => {}); }, 120000);
app.listen(port);
startNyoni();
