const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const express = require("express");

// --- 1. WEB SERVER FOR PAIRING CODE ---
const app = express();
const port = process.env.PORT || 10000;

// Enable static file serving (Important for index.html)
app.use(express.static(path.join(__dirname, '.')));

// Global variable for the bot socket
let sock;

// Serve the pairing page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint to generate pairing code
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Phone number is required!" });
    num = num.replace(/[^0-9]/g, '');

    if (!sock) {
        return res.status(503).json({ error: "Bot is still starting, please wait 15 seconds." });
    }

    try {
        let code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) {
        console.error("Pairing Error:", err);
        res.status(500).json({ error: "Server busy. Try clicking again." });
    }
});

app.listen(port, () => {
    console.log(`Web server active on port ${port}`);
});

// --- 2. BOT CORE LOGIC ---
const prefix = ",";

async function startNyoni() {
    // Create session folder if it doesn't exist
    if (!fs.existsSync('./session')) {
        fs.mkdirSync('./session');
    }

    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        // Critical for pairing code stability
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // Plugin Loader
    const commands = new Map();
    const pluginsPath = path.join(__dirname, 'plugins');
    if (fs.existsSync(pluginsPath)) {
        fs.readdirSync(pluginsPath).forEach(file => {
            if (file.endsWith(".js")) {
                try {
                    const plugin = require(path.join(pluginsPath, file));
                    commands.set(plugin.name, plugin);
                } catch (e) {
                    console.error(`Error loading ${file}:`, e);
                }
            }
        });
    }

    // Connection Updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNyoni();
        } else if (connection === 'open') {
            console.log('NYONI-XMD CONNECTED! 🚀');
            // Send startup notification to your newsletter
            await sock.sendMessage("120363399470975987@newsletter", { 
                text: "NYONI-XMD IS NOW ONLINE! 🚀\nPrefix: ,\nStatus: Stable" 
            });
        }
    });

    sock.ev.on('creds.update', saveCreds);

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
            }
        }
    });
}

// Start the process
startNyoni();
