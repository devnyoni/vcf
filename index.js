const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    downloadContentFromMessage
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

// --- 1. SETTINGS ZA BOT ---
global.botSettings = {
    publicMode: true,    // true = Kila mtu, false = Owner pekee
    alwaysOnline: true,
    autoType: true,
    autoReact: true,
    autoStatus: true,
    chatbot: true,
    myUrl: "https://nyoni-md-free.onrender.com" // WEKA LINK YAKO YA RENDER HAPA
};

// --- 2. SERVER YA PAIRING NA KEEP-ALIVE ---
app.use(express.static(path.join(__dirname, '.')));

app.get('/', (req, res) => {
    res.send("NYONI-XMD is Running Safely!");
});

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Provide your number! Example: /code?number=255xxxxxxxxx");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock) return res.status(500).send("Bot engine starting... Refresh in 10s");
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) {
        res.status(500).send("WhatsApp connection error. Try again.");
    }
});

app.listen(port, () => console.log(`Server live on port ${port}`));

// --- 3. PLUGIN LOADER ---
const commands = new Map();
function loadPlugins() {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);
    const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
        try {
            const plugin = require(`./plugins/${file}`);
            if (plugin.name) commands.set(plugin.name, plugin);
        } catch (e) { console.log(`Error loading ${file}`); }
    }
}

// --- 4. ENGINE YA NYONI-XMD ---
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

    // --- MFUMO WA KURECONNECT USIZIME (Miezi 4+) ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Connection lost. Reconnecting in 5 seconds...");
                setTimeout(() => startNyoni(), 5000);
            } else {
                console.log("Logged out. Please re-pair your number.");
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD CONNECTED SUCCESSFULLY!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
            if (msg.key.remoteJid === 'status@broadcast' && global.botSettings.autoStatus) {
                await sock.readMessages([msg.key]);
            }
            return;
        }

        const from = msg.key.remoteJid;
        const isOwner = msg.key.fromMe;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isCmd = body.startsWith(prefix);

        if (!global.botSettings.publicMode && !isOwner) return;

        // AUTOMATION
        if (global.botSettings.alwaysOnline) await sock.sendPresenceUpdate('available', from);
        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);

        // --- COMMANDS ZA KIINGEREZA ---
        
        // Mode Management
        if (isOwner && body === '.mode public') {
            global.botSettings.publicMode = true;
            return sock.sendMessage(from, { text: "✅ *Mode updated to PUBLIC.*" });
        }
        if (isOwner && body === '.mode self') {
            global.botSettings.publicMode = false;
            return sock.sendMessage(from, { text: "🔒 *Mode updated to PRIVATE (Self).* Kakun!" });
        }

        // Set Profile Picture (.setpp)
        if (isOwner && body === '.setpp') {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted?.imageMessage) {
                const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                await sock.updateProfilePicture(sock.user.id, buffer);
                return sock.sendMessage(from, { text: "✅ *Profile picture updated successfully!*" });
            } else {
                return sock.sendMessage(from, { text: "❌ *Please reply to an image with .setpp*" });
            }
        }

        // --- PLUGIN HANDLER ---
        if (!isCmd) return;
        const args = body.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const plugin = commands.get(cmdName);
        if (plugin) {
            try { await plugin.execute(sock, from, msg, args, commands); }
            catch (e) { console.error(e); }
        }
    });
}

// --- 5. KEEP-ALIVE MECHANISM (Kuzuia Render isilale) ---
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
    console.log("Keep-alive ping sent!");
}, 10 * 60 * 1000); // Inatuma ping kila dakika 10

startNyoni();
