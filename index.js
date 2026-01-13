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
    publicMode: true,
    autoStatus: true,       // Inasoma status
    autoStatusReact: true,  // Inaweka emoji kwenye status
    statusEmoji: "🫡",      // Emoji unayotaka itumike
    myUrl: "https://nyoni-md-free.onrender.com" // Link yako ya Render
};

// --- 2. SERVER YA PAIRING (FIXED) ---
app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));

// Hii ndio sehemu inayotatua tatizo la kutopata Pairing Code
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Weka namba yako! Mfano: /code?number=255712345678");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock) return res.status(500).send("Bot engine inaanza... subiri sekunde 10.");
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) {
        res.status(500).send("WhatsApp Error: Jaribu tena baada ya dakika 1.");
    }
});

app.listen(port, () => console.log(`Server live on port ${port}`));

// --- 3. PLUGIN LOADER (FIXED TO RESPOND) ---
const commands = new Map();
function loadPlugins() {
    const pluginsPath = path.join(__dirname, 'plugins'); //
    if (fs.existsSync(pluginsPath)) {
        const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                const plugin = require(`./plugins/${file}`);
                if (plugin.name) commands.set(plugin.name, plugin);
            } catch (e) { console.log(`Error loading ${file}`); }
        }
    }
}

// --- 4. ENGINE YA NYONI-XMD ---
async function startNyoni() {
    // Inatumia folder la 'session' ulilonalo GitHub
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
        browser: ["Chrome (Linux)", "Nyoni-MD", "1.0.0"] 
    });

    loadPlugins();
    sock.ev.on('creds.update', saveCreds);

    // --- MFUMO WA KURECONNECT (Isizime) ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Connection lost, restarting...");
                setTimeout(() => startNyoni(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IS ONLINE AND RESPONDING!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isOwner = msg.key.fromMe;

        // --- AUTO STATUS (View & React) ---
        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
            }
            return;
        }

        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        
        // --- COMMAND HANDLER ---
        if (body.startsWith(prefix)) {
            const args = body.slice(prefix.length).trim().split(/ +/);
            const cmdName = args.shift().toLowerCase();
            const plugin = commands.get(cmdName);

            if (plugin) {
                try {
                    await plugin.execute(sock, from, msg, args);
                } catch (e) { console.error(e); }
            }

            // --- .setpp Command FIX ---
            if (isOwner && cmdName === 'setpp') {
                const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quoted?.imageMessage) {
                    const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    await sock.updateProfilePicture(sock.user.id, buffer);
                    return sock.sendMessage(from, { text: "✅ *Profile Picture Updated!*" });
                }
            }
        }
    });
}

// Keep-alive kuzuia Render isilale
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 5 * 60 * 1000);

startNyoni();
