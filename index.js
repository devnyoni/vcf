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
let sock; // Variable ya global ili Express iione
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

// --- 1. PLUGIN LOADER (Fixed) ---
const plugins = new Map();
function loadPlugins() {
    const pluginFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder);
    
    const files = fs.readdirSync(pluginFolder).filter(file => file.endsWith('.js'));
    plugins.clear();
    
    for (const file of files) {
        try {
            const pluginPath = `./plugins/${file}`;
            delete require.cache[require.resolve(pluginPath)];
            const command = require(pluginPath);
            
            const cmdName = command.name || file.replace('.js', '');
            plugins.set(cmdName, {
                ...command,
                name: cmdName,
                category: command.category || "OTHERS"
            });
        } catch (e) {
            console.error(`❌ Error loading plugin ${file}:`, e);
        }
    }
    console.log(`✅ Loaded ${plugins.size} plugins!`);
}

// --- 2. PAIRING CODE ROUTE (Fixed) ---
app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Weka namba! Mfano: /code?number=2557xxxxxxxx");
    
    num = num.replace(/[^0-9]/g, '');
    
    if (!sock) {
        return res.status(500).json({ error: "Bot is starting, please wait and refresh." });
    }

    try {
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Imeshindikana kupata code. Hakikisha bot haijaunganishwa tayari." });
    }
});

app.listen(port, () => console.log(`Server live on port ${port}`));

// --- 3. MAIN BOT FUNCTION ---
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
        printQRInTerminal: false, // Tunatumia pairing code badala ya QR
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
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
            console.log('✅ NYONI-XMD IS ONLINE!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') return;

        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || "").trim();
        
        const isCmd = body.startsWith(prefix);
        const commandName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);
        const isOwner = msg.key.fromMe;

        if (isCmd) {
            if (!global.botSettings.publicMode && !isOwner) return;

            // --- FIXED AUTOMATIC MENU ---
            if (commandName === 'menu') {
                const categories = {};
                plugins.forEach(p => {
                    const cat = p.category.toUpperCase();
                    if (!categories[cat]) categories[cat] = [];
                    categories[cat].push(p.name);
                });

                let menuText = `🌟 *NYONI-XMD COMMANDS* 🌟\n\n`;
                menuText += `👤 *User:* @${(msg.key.participant || from).split('@')[0]}\n`;
                menuText += `🛠️ *Prefix:* ${prefix}\n\n`;

                const sortedCats = Object.keys(categories).sort();
                for (const cat of sortedCats) {
                    menuText += `*╭┈〔 ${cat} 〕┈─*\n`;
                    categories[cat].sort().forEach(cmd => {
                        menuText += `┃ ✧ ${prefix}${cmd}\n`;
                    });
                    menuText += `╰──────────┈\n\n`;
                }

                return await sock.sendMessage(from, { 
                    image: { url: thumbUrl }, 
                    caption: menuText,
                    mentions: [msg.key.participant || from]
                }, { quoted: msg });
            }

            // Plugin Execution
            const plugin = plugins.get(commandName);
            if (plugin) {
                try {
                    await plugin.execute(sock, from, msg, args);
                } catch (e) {
                    console.error(e);
                }
            }
        }
    });
}

// Keep-alive
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 5 * 60 * 1000);

startNyoni();
