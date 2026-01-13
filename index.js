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

// GLOBAL CONFIGURATION
global.prefix = "."; 
global.thumbUrl = "https://files.catbox.moe/t4ts87.jpeg";
global.groupSettings = {}; // Stores Anti-Sticker etc.

global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,
    autoStatus: true,
    autoStatusReact: true,
    // Multi-Emoji List for Status and Messages
    emojis: ["🔥", "⚡", "❤️", "🫡", "💎", "✨", "👑", "🚀", "🤖", "⭐", "✅", "🌀"]
};

// Helper: Get Random Emoji
const getRandomEmoji = () => global.botSettings.emojis[Math.floor(Math.random() * global.botSettings.emojis.length)];

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
            if (Array.isArray(command)) {
                command.forEach(c => plugins.set(c.name, c));
            } else if (command.name) {
                plugins.set(command.name, command);
            }
        } catch (e) { console.error(`Error loading ${file}:`, e); }
    }
}

app.get('/', (req, res) => res.send("NYONI-XMD IS RUNNING 🚀"));
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
            console.log('✅ NYONI-XMD CONNECTED');
            const ownerJid = jidNormalizedUser(sock.user.id);
            await sock.sendMessage(ownerJid, { text: "🚀 *NYONI-XMD IS FULLY ACTIVE!*\n\nAuto-Status: ON\nAuto-React: ON\nMode: PUBLIC" });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const isStatus = from === 'status@broadcast';
        const sender = isGroup ? msg.key.participant : from;

        // --- 1. AUTO STATUS REACTION (Multi-Emoji) ---
        if (isStatus && global.botSettings.autoStatus) {
            await sock.readMessages([msg.key]);
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { 
                    react: { text: getRandomEmoji(), key: msg.key } 
                }, { statusJidList: [msg.key.participant] });
            }
            return;
        }

        // --- 2. ANTI-STICKER LOGIC ---
        if (isGroup && global.groupSettings?.[from]?.antisticker && msg.message.stickerMessage) {
            const metadata = await sock.groupMetadata(from);
            const isAdmin = metadata.participants.find(p => p.id === sender)?.admin;
            if (!isAdmin) {
                await sock.sendMessage(from, { delete: msg.key });
                return; // Stop further processing
            }
        }

        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
        const isOwner = msg.key.fromMe || sender.split('@')[0] === sock.user.id.split(':')[0];
        
        if (!body.startsWith(global.prefix)) return;

        // --- 3. AUTO MESSAGE REACTION (Multi-Emoji) ---
        await sock.sendMessage(from, { react: { text: getRandomEmoji(), key: msg.key } });

        const commandName = body.slice(global.prefix.length).trim().split(' ')[0].toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        if (!global.botSettings.publicMode && !isOwner) return;
        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);

        // --- 4. MENU HANDLER ---
        if (commandName === 'menu') {
            const categories = {};
            plugins.forEach(p => {
                const cat = p.category || "MAIN";
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(p.name);
            });

            let menuText = `🚀 *NYONI-XMD DASHBOARD*\n\n`;
            for (const [cat, cmds] of Object.entries(categories)) {
                menuText += `*╭┈〔 🏠 ${cat.toUpperCase()} 〕┈─*\n`;
                cmds.forEach(cmd => { menuText += `┃ ✧ ${global.prefix}${cmd}\n`; });
                menuText += `╰──────────┈\n\n`;
            }
            return await sock.sendMessage(from, { image: { url: global.thumbUrl }, caption: menuText }, { quoted: msg });
        }

        const plugin = plugins.get(commandName);
        if (plugin) {
            try { await plugin.execute(sock, from, msg, args); } 
            catch (err) { console.error(err); }
        }
    });
}

// KEEP-ALIVE SYSTEM
setInterval(() => { axios.get("https://nyoni-md-free.onrender.com/").catch(() => {}); }, 120000);

app.listen(port, () => console.log(`Server started on port ${port}`));
startNyoni();
