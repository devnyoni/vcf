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

const app = express();
const port = process.env.PORT || 10000;
let sock;
const prefix = ".";

// --- 1. WEB SERVER FOR PAIRING ---
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Number required" });
    num = num.replace(/[^0-9]/g, '');
    try {
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code });
    } catch (err) {
        res.status(500).json({ error: "Error. Try again." });
    }
});

app.listen(port, () => console.log(`Server live on port ${port}`));

// --- 2. ADVANCED PLUGIN LOADER ---
const commands = new Map();

function loadPlugins() {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
        try {
            const plugin = require(`./plugins/${file}`);
            if (plugin.name) {
                commands.set(plugin.name, plugin);
                console.log(`✅ Loaded: ${plugin.name}`);
            }
        } catch (e) {
            console.log(`❌ Failed to load ${file}:`, e);
        }
    }
}

// --- 3. CORE BOT LOGIC ---
async function startNyoni() {
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
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    loadPlugins();

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNyoni();
        } else if (connection === 'open') {
            console.log('NYONI-XMD SYSTEM IS LIVE! 🚀');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isCmd = body.startsWith(prefix);

        // --- FEATURE: AUTO STATUS VIEWER ---
        if (from === 'status@broadcast') {
            await sock.readMessages([msg.key]);
            return;
        }

        if (msg.key.fromMe) return;

        // --- FEATURE: ALWAYS ONLINE & ACTIONS ---
        await sock.sendPresenceUpdate('available', from);
        await sock.sendPresenceUpdate('composing', from);

        // --- FEATURE: AUTO REACTION ---
        await sock.sendMessage(from, { react: { text: "🤖", key: msg.key } });

        // --- 4. CHATBOT LOGIC (Non-Command Messages) ---
        if (!isCmd && body.length > 0) {
            const input = body.toLowerCase();
            let response = "";

            if (input.includes("hello") || input.includes("mambo")) {
                response = "Hello! I am NYONI-XMD. How can I help you today? Type .menu to see my features.";
            } else if (input.includes("who are you")) {
                response = "I am a professional WhatsApp bot developed by Nyoni. I can manage groups, download videos, and more!";
            } else if (input.includes("prefix")) {
                response = "My current prefix is [ . ]";
            }

            if (response) {
                await sock.sendMessage(from, { text: response }, { quoted: msg });
                return; // Stop here if chatbot answered
            }
        }

        // --- 5. COMMAND HANDLER ---
        if (!isCmd) return;

        const args = body.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();

        const plugin = commands.get(cmdName);
        if (plugin) {
            try {
                await plugin.execute(sock, from, msg, args, commands);
            } catch (err) {
                console.error(err);
                await sock.sendMessage(from, { text: "Command Error!" });
            }
        }
    });
}

startNyoni();
