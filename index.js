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

// --- 1. GLOBAL SETTINGS ---
global.botSettings = {
    alwaysOnline: true,
    autoType: true,
    autoRecord: false,
    autoReact: true,
    autoStatus: true,
    chatbot: true // Chatbot toggle
};

// --- 2. PAIRING SERVER ---
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
        res.status(500).json({ error: "Server Error" });
    }
});
app.listen(port, () => console.log(`Server live on port ${port}`));

// --- 3. PLUGIN LOADER ---
const commands = new Map();
function loadPlugins() {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);
    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
        try {
            const plugin = require(`./plugins/${file}`);
            if (plugin.name) commands.set(plugin.name, plugin);
        } catch (e) { console.log(`Error loading ${file}`); }
    }
}

// --- 4. START BOT ---
async function startNyoni() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    sock = makeWASocket({
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
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'close') startNyoni();
        if (u.connection === 'open') console.log('NYONI-XMD CONNECTED! 🚀');
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isCmd = body.startsWith(prefix);

        // A. AUTO STATUS VIEWER
        if (from === 'status@broadcast' && global.botSettings.autoStatus) {
            await sock.readMessages([msg.key]);
            return;
        }
        if (msg.key.fromMe) return;

        // B. AUTOMATION PRESENCE
        if (global.botSettings.alwaysOnline) await sock.sendPresenceUpdate('available', from);
        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);
        if (global.botSettings.autoRecord) await sock.sendPresenceUpdate('recording', from);
        if (global.botSettings.autoReact) await sock.sendMessage(from, { react: { text: "🤖", key: msg.key } });

        // C. CHATBOT LOGIC (Triggered if not a command)
        if (!isCmd && global.botSettings.chatbot && body.length > 0) {
            const input = body.toLowerCase();
            let reply = "";

            if (input.includes("hello") || input.includes("mambo")) {
                reply = "Hello! I am NYONI-XMD. How can I assist you? Type .menu for commands.";
            } else if (input.includes("bot")) {
                reply = "Yes? I am active and listening! ⚡";
            } else if (input.includes("owner")) {
                reply = "My developer is Nyoni. You can use .owner to get his contact.";
            }

            if (reply) {
                await sock.sendMessage(from, { text: reply }, { quoted: msg });
                return;
            }
        }

        // D. COMMAND HANDLER
        if (!isCmd) return;
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
startNyoni();
