const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    downloadContentFromMessage,
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
const plugins = new Map();

// --- GLOBAL SETTINGS ---
global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,
    autoStatus: true,
    autoStatusReact: true,
    statusEmoji: "🫡",
    menuImage: "https://files.catbox.moe/t4ts87.jpeg",
    myUrl: "https://nyoni-md-free.onrender.com"
};

// --- AUTOMATIC PLUGIN LOADER ---
function loadPlugins() {
    const pluginFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder);

    fs.readdirSync(pluginFolder).forEach(file => {
        if (file.endsWith('.js')) {
            try {
                const pluginPath = path.join(pluginFolder, file);
                delete require.cache[require.resolve(pluginPath)];
                const plugin = require(pluginPath);
                if (plugin.name) {
                    plugins.set(plugin.name, plugin);
                    console.log(`✅ Loaded: ${file}`);
                }
            } catch (e) {
                console.log(`❌ Error in ${file}: ${e.message}`);
            }
        }
    });
}

// --- FIX: PAIRING CODE ROUTE ---
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Number is required! Example: /code?number=255xxxxxxxxx");
    num = num.replace(/[^0-9]/g, '');

    if (!sock) return res.status(503).send("Server is starting, please refresh in 10 seconds.");

    try {
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) {
        console.error("Pairing Error:", err);
        res.status(500).send("WhatsApp Pairing Failed. Ensure the bot is not already connected.");
    }
});

app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));
app.listen(port, () => console.log(`Server live on port ${port}`));

async function startNyoni() {
    loadPlugins(); 
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    sock = makeWASocket({
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
            const shouldRestart = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldRestart) setTimeout(() => startNyoni(), 5000);
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD CONNECTED');
            await sock.sendMessage(jidNormalizedUser(sock.user.id), { 
                text: "🚀 *NYONI-XMD IS ONLINE*\n\nPairing successful. Automatic Menu is active." 
            });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
            // Auto-Status logic
            if (msg.key.remoteJid === 'status@broadcast' && global.botSettings.autoStatus) {
                await sock.readMessages([msg.key]);
                if (global.botSettings.autoStatusReact) {
                    await sock.sendMessage('status@broadcast', { 
                        react: { text: global.botSettings.statusEmoji, key: msg.key } 
                    }, { statusJidList: [msg.key.participant] });
                }
            }
            return;
        }

        const from = msg.key.remoteJid;
        const isOwner = msg.key.fromMe;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isCmd = body.startsWith(prefix);
        const commandName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";

        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);
        if (!global.botSettings.publicMode && !isOwner) return;

        // --- AUTOMATIC MENU COMMAND ---
        if (commandName === 'menu') {
            await sock.sendMessage(from, { react: { text: "🏠", key: msg.key } });
            
            let menuContent = `*╭┈〔 🏠 MAIN 〕┈─*\n`;
            // This loop reads every plugin name automatically
            plugins.forEach((plugin) => {
                menuContent += `┃ ✧ \`${prefix}${plugin.name}\`\n`;
            });
            menuContent += `╰──────────┈`;

            return sock.sendMessage(from, { 
                image: { url: global.botSettings.menuImage }, 
                caption: menuContent 
            }, { quoted: msg });
        }

        // --- PLUGIN EXECUTION ---
        const plugin = plugins.get(commandName);
        if (plugin) {
            await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
            try {
                await plugin.execute(sock, msg, from, { body, prefix, isOwner });
            } catch (e) {
                console.error(e);
            }
        }
    });
}

// Keep-alive to prevent Render from sleeping
setInterval(() => { axios.get(global.botSettings.myUrl).catch(() => {}); }, 2 * 60 * 1000);

startNyoni();
