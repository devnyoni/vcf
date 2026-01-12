const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const express = require("express");

// --- 1. WEB SERVER CONFIGURATION ---
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 2. BOT CORE VARIABLES ---
let sock;
const commands = new Map();
const prefix = ",";
const ownerNumber = "255610209120";

// Pairing Code Route
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Please enter your number!" });
    num = num.replace(/[^0-9]/g, '');

    if (!sock) return res.status(500).json({ error: "Bot is starting, please wait..." });

    try {
        let code = await sock.requestPairingCode(num);
        res.json({ code: code });
    } catch (err) {
        console.error("Pairing Error:", err);
        res.status(500).json({ error: "Could not generate code" });
    }
});

app.listen(port, () => {
    console.log(`Web server active on port ${port}`);
});

// --- 3. START THE BOT ---
async function startNyoni() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Nyoni-XMD", "Chrome", "20.0.04"]
    });

    // Load Plugins
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

    fs.readdirSync(pluginsPath).forEach(file => {
        if (file.endsWith(".js")) {
            try {
                const plugin = require(path.join(pluginsPath, file));
                commands.set(plugin.name, plugin);
                console.log(`Successfully loaded: ${plugin.name}`);
            } catch (e) {
                console.error(`Error loading ${file}:`, e);
            }
        }
    });

    // Message Handler
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

        if (!body.startsWith(prefix)) return;

        const args = body.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();

        const plugin = commands.get(cmdName);
        if (plugin) {
            try {
                await plugin.execute(sock, from, msg, args, commands);
            } catch (err) {
                console.error(err);
                await sock.sendMessage(from, { text: "⚠️ Error executing command!" });
            }
        }
    });

    // Connection Handler
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNyoni();
        } else if (connection === 'open') {
            console.log('NYONI-XMD IS LIVE! 🚀');
            // Notification to your Newsletter
            await sock.sendMessage("120363399470975987@newsletter", { 
                text: "NYONI-XMD IS NOW LIVE AND READY! 🚀\n\nOwner: Nyoni-xmd" 
            });
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startNyoni();
