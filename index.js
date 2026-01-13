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

// GLOBAL SETTINGS
global.prefix = "."; 
global.thumbUrl = "https://files.catbox.moe/t4ts87.jpeg";
global.botSettings = {
    publicMode: true,
    autoType: true,
    autoStatus: true,
    autoStatusReact: true,
    statusEmoji: "🫡",
    antiSticker: true, // Sehemu mpya ya Anti-Sticker
    myUrl: "https://nyoni-md-free.onrender.com" // Update with your Render URL
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
            await sock.sendMessage(ownerJid, { text: "🚀 *NYONI-XMD CONNECTED!*" });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
            if (msg.key.remoteJid === 'status@broadcast' && global.botSettings.autoStatus) {
                await sock.readMessages([msg.key]);
                if (global.botSettings.autoStatusReact) {
                    await sock.sendMessage(msg.key.remoteJid, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
                }
            }
            return;
        }

        const from = msg.key.remoteJid;
        const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
        const isSticker = msg.message.stickerMessage;

        // --- SEHEMU YA ANTISTICKER ---
        if (isSticker && global.botSettings.antiSticker && !isOwner) {
            await sock.sendMessage(from, { delete: msg.key });
            return; // Zuia bot kuendelea kuchakata sticker
        }

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

setInterval(() => { axios.get(global.botSettings.myUrl).catch(() => {}); }, 120000);
app.listen(port);
startNyoni();
