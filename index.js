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

// GLOBAL SETTINGS
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
    stickerTimeout: 5 * 60 * 1000, // Dakika 5
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
            if (command.name) {
                plugins.set(command.name, command);
            }
        } catch (e) {
            console.error(`Error loading plugin ${file}:`, e);
        }
    }
    console.log(`✅ Loaded ${plugins.size} plugins!`);
}

// --- EXPRESS SERVER ---
app.get('/', (req, res) => res.send("NYONI-XMD ACTIVE 🚀"));
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Weka namba!");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock) return res.status(500).json({ error: "Inawaka..." });
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { res.status(500).json({ error: "WA Error" }); }
});

app.listen(port, () => console.log(`Server on port ${port}`));

// --- MAIN BOT FUNCTION ---
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
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const type = Object.keys(msg.message)[0];
        const sender = isGroup ? msg.key.participant : msg.key.remoteJid;
        const isOwner = msg.key.fromMe || sender.split('@')[0] === sock.user.id.split(':')[0];

        // 1. ANTI-STICKER LOGIC
        if (isGroup && type === 'stickerMessage' && global.botSettings.antiSticker && !isOwner) {
            const groupMetadata = await sock.groupMetadata(from);
            const isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin !== null;
            
            if (!isAdmin) {
                await sock.sendMessage(from, { delete: msg.key });
                if (global.botSettings.stickerWarning) {
                    await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]} Stickers haziruhusiwi hapa!`, mentions: [sender] });
                }
                return;
            }
        }

        // 2. AUTO STATUS
        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [sender] });
            }
            return;
        }

        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
        if (!body.startsWith(prefix)) return;

        const commandName = body.slice(prefix.length).trim().split(' ')[0].toLowerCase();
        const args = body.trim().split(/ +/).slice(1);

        if (!global.botSettings.publicMode && !isOwner) return;

        // Auto Typing
        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);

        // 3. AUTOMATIC MENU
        if (commandName === 'menu') {
            const categories = {};
            plugins.forEach(p => {
                const cat = (p.category || "MAIN").toUpperCase();
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(p.name);
            });

            let menuText = `🚀 *NYONI-XMD DASHBOARD*\n\n`;
            menuText += `*Prefix:* [ ${prefix} ]\n`;
            menuText += `*Mode:* ${global.botSettings.publicMode ? 'Public' : 'Self'}\n`;
            menuText += `*Anti-Sticker:* ${global.botSettings.antiSticker ? 'ON' : 'OFF'}\n\n`;

            for (const [cat, cmds] of Object.entries(categories)) {
                menuText += `*╭┈〔 🏠 ${cat} 〕┈─*\n`;
                cmds.sort().forEach(cmd => {
                    menuText += `┃ ✧ ${prefix}${cmd}\n`;
                });
                menuText += `╰──────────┈\n\n`;
            }

            return await sock.sendMessage(from, { image: { url: thumbUrl }, caption: menuText }, { quoted: msg });
        }

        // 4. PLUGIN EXECUTION
        const plugin = plugins.get(commandName);
        if (plugin) {
            try {
                await plugin.execute(sock, from, msg, args);
            } catch (err) {
                console.error(err);
            }
        }
    });
}

setInterval(() => { axios.get(global.botSettings.myUrl).catch(() => {}); }, 120000);
startNyoni();
