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
    myUrl: "https://nyoni-md-free.onrender.com"
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
                text: "🚀 *NYONI-XMD IMEUNGANISHWA!*\n\nAuto-Status na Plugins ziko tayari." 
            });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        
        // --- AUTO STATUS VIEW/REACT ---
        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
            }
            return;
        }

        const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
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

// Keep-alive kuzuia Render isilale
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 2 * 60 * 1000);

startNyoni();
