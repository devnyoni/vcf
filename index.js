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
    antiSticker: true,  // Setting mpya ya antisticker
    stickerWarning: true, // Kuonya kuhusu stickers
    stickerTimeout: 5 * 60 * 1000, // 5 dakika ya mute
    stickerBannedGroups: [] // Array ya groups zilizoban stickers
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
            // Futa cache ili kuwezesha hot-reload ukibadilisha file
            delete require.cache[require.resolve(`./plugins/${file}`)];
            const command = require(`./plugins/${file}`);
            if (command.name) {
                plugins.set(command.name, command);
            }
        } catch (e) {
            console.error(`Error loading plugin ${file}:`, e);
        }
    }
    console.log(`✅ Loaded ${plugins.size} plugins!`);
}

// --- STICKER PROTECTION SYSTEM ---
const stickerViolations = new Map(); // userJid: {count, lastViolation}

function checkStickerPermission(groupJid, userJid) {
    if (!global.botSettings.antiSticker) return true;
    if (global.botSettings.stickerBannedGroups.includes(groupJid)) return false;
    
    const violations = stickerViolations.get(userJid);
    if (violations && Date.now() - violations.lastViolation < global.botSettings.stickerTimeout) {
        return false; // User amemute
    }
    return true;
}

async function handleStickerViolation(sock, msg, from, senderJid) {
    const groupMetadata = await sock.groupMetadata(from).catch(() => null);
    const violations = stickerViolations.get(senderJid) || { count: 0, lastViolation: 0 };
    
    violations.count++;
    violations.lastViolation = Date.now();
    stickerViolations.set(senderJid, violations);
    
    if (global.botSettings.stickerWarning) {
        const warnings = violations.count;
        let action = "";
        
        if (warnings >= 3) {
            // Mute user kwa muda
            try {
                const expiration = Date.now() + global.botSettings.stickerTimeout;
                await sock.groupParticipantsUpdate(from, [senderJid], 'restrict');
                action = `⏳ Muted for ${global.botSettings.stickerTimeout / (60 * 1000)} minutes`;
            } catch (e) {
                console.error("Failed to mute user:", e);
            }
        }
        
        const warningMsg = `⚠️ *STICKER WARNING*\n\n` +
                          `User: @${senderJid.split('@')[0]}\n` +
                          `Warning #${warnings}\n` +
                          `${action}\n\n` +
                          `_Stickers are disabled in this group._`;
        
        await sock.sendMessage(from, { 
            text: warningMsg,
            mentions: [senderJid]
        }, { quoted: msg });
    }
    
    try {
        await sock.sendMessage(from, { delete: msg.key });
    } catch (e) {
        console.error("Failed to delete sticker:", e);
    }
}

// --- EXPRESS ROUTES ---
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Weka namba! Mfano: /code?number=255xxxxxxxxx");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock) {
            return res.status(500).json({ error: "Bot bado inawaka, jaribu tena baada ya sekunde 10." });
        }
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "WhatsApp Error au Namba imekosewa." }); 
    }
});

// Route mpya ya kudhibiti antisticker settings
app.get('/antisticker', (req, res) => {
    res.json({
        enabled: global.botSettings.antiSticker,
        bannedGroups: global.botSettings.stickerBannedGroups,
        violations: Object.fromEntries(stickerViolations)
    });
});

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
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Connection lost. Restarting...");
                setTimeout(() => startNyoni(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IS LIVE!');
            const ownerJid = jidNormalizedUser(sock.user.id);
            await sock.sendMessage(ownerJid, { 
                text: "🚀 *NYONI-XMD IMEUNGANISHWA!*\n\n" +
                      `Anti-Sticker: ${global.botSettings.antiSticker ? '✅' : '❌'}\n` +
                      "Plugins ziko tayari." 
            });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        // --- ANTI-STICKER SYSTEM ---
        if (isGroup && msg.message.stickerMessage && global.botSettings.antiSticker) {
            const senderJid = msg.key.participant || msg.key.remoteJid;
            
            if (!checkStickerPermission(from, senderJid)) {
                await handleStickerViolation(sock, msg, from, senderJid);
                return;
            }
        }

        // --- AUTO STATUS VIEW/REACT ---
        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
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

            // 1. Auto React & Typing
            await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
            if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);

            // 2. AUTOMATIC MENU
            if (commandName === 'menu') {
                const categories = {};
                plugins.forEach(p => {
                    const cat = p.category || "MAIN";
                    if (!categories[cat]) categories[cat] = [];
                    categories[cat].push(p.name);
                });

                let menuText = `*NYONI-XMD AUTOMATIC MENU*\n\n`;
                menuText += `⚙️ Settings:\n`;
                menuText += `• Anti-Sticker: ${global.botSettings.antiSticker ? '✅' : '❌'}\n`;
                menuText += `• Public Mode: ${global.botSettings.publicMode ? '✅' : '❌'}\n\n`;

                for (const [cat, cmds] of Object.entries(categories)) {
                    menuText += `*╭┈〔 🏠 ${cat.toUpperCase()} 〕┈─*\n`;
                    cmds.forEach(cmd => {
                        menuText += `┃ ✧ ${prefix}${cmd}\n`;
                    });
                    menuText += `╰──────────┈\n\n`;
                }

                return await sock.sendMessage(from, { 
                    image: { url: thumbUrl }, 
                    caption: menuText 
                }, { quoted: msg });
            }

            // 3. PLUGIN HANDLER
            const plugin = plugins.forEach(cmd => {
                const plugin = plugins.get(commandName);
                if (plugin) {
                    try {
                        // Check admin for antisticker commands
                        if (commandName === 'antisticker' && isGroup) {
                            const metadata = await sock.groupMetadata(from);
                            const isAdmin = metadata.participants.find(p => p.id === msg.key.participant)?.admin;
                            if (!isAdmin && !isOwner) {
                                return sock.sendMessage(from, { text: "❌ Command hii ni ya admins tu!" });
                            }
                        }
                        plugin.execute(sock, from, msg, args);
                    } catch (err) {
                        console.error(err);
                        sock.sendMessage(from, { text: "❌ Error executing command." });
                    }
                }
            });
        }
    });
}

// Keep-alive kuzuia Render isilale
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 2 * 60 * 1000);

startNyoni();
