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

const app = express();
const port = process.env.PORT || 10000;
let sock;
const prefix = ".";

// --- 1. GLOBAL SETTINGS ---
global.botSettings = {
    publicMode: true,    // true = Everyone, false = Owner only
    alwaysOnline: true,
    autoType: true,
    autoReact: true,
    autoStatus: true,
    chatbot: true
};

// --- 2. IMPROVED PAIRING SERVER (Uhakika 100%) ---
app.use(express.static(path.join(__dirname, '.')));

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Please provide your number. Example: /code?number=255xxxxxxxxx");
    
    num = num.replace(/[^0-9]/g, ''); // Inafuta alama zisizohitajika

    try {
        if (!sock) return res.status(500).send("Bot is not ready yet. Please refresh in 10 seconds.");
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) {
        console.log("Pairing Error:", err);
        res.status(500).send("WhatsApp connection failed. Try again after 1 minute.");
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

// --- 4. START NYONI-XMD ---
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
        browser: ["Ubuntu", "Chrome", "20.0.04"] // Hii ni muhimu kwa Pairing Code
    });

    loadPlugins();
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        const { connection, lastDisconnect } = u;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNyoni();
        } else if (connection === 'open') {
            console.log('NYONI-XMD IS LIVE! 🚀');
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

        // --- PUBLIC/PRIVATE PROTECTION ---
        if (!global.botSettings.publicMode && !isOwner) return;

        // --- AUTOMATION ---
        if (global.botSettings.alwaysOnline) await sock.sendPresenceUpdate('available', from);
        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);
        if (global.botSettings.autoReact) await sock.sendMessage(from, { react: { text: "🤖", key: msg.key } });

        // --- ENGLISH COMMANDS (Inside Index) ---
        
        // Change Mode to Public or Self
        if (isOwner && body === '.mode public') {
            global.botSettings.publicMode = true;
            return sock.sendMessage(from, { text: "✅ *Bot mode set to PUBLIC.* Anyone can use me now." });
        }
        if (isOwner && body === '.mode self') {
            global.botSettings.publicMode = false;
            return sock.sendMessage(from, { text: "🔒 *Bot mode set to PRIVATE.* Only the owner can use me." });
        }

        // Change Profile Picture (.setpp)
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

        // --- CHATBOT ---
        if (!isCmd && global.botSettings.chatbot && body.length > 0) {
            const input = body.toLowerCase();
            if (input.includes("hello") || input.includes("mambo")) return sock.sendMessage(from, { text: "Hello! I am Nyoni-XMD. How can I help you today?" });
        }

        // --- COMMAND HANDLER ---
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
startNyoni();
