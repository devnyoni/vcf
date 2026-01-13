const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    downloadContentFromMessage,
    getAggregateVotesInPollMessage
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

// --- GLOBAL SETTINGS ---
global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,
    autoReact: true,
    autoStatus: true,       // Inasoma status
    autoStatusReact: true,  // Inajibu status kwa Emoji
    statusEmoji: "🫡",      // Emoji ya kuweka kwenye Status
    myUrl: "https://nyoni-md-free.onrender.com"
};

app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Provide number! Example: /code?number=255xxxxxxxxx");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock) return res.status(500).send("Bot starting...");
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { res.status(500).send("WhatsApp Error."); }
});

app.listen(port, () => console.log(`Server live on port ${port}`));

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

    sock.ev.on('creds.update', saveCreds);

    // --- CONNECTION UPDATE (Isizime) ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Connection lost. Restarting...");
                setTimeout(() => startNyoni(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IS LIVE!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isOwner = msg.key.fromMe;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

        // --- AUTO STATUS VIEW & REACT ---
        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) {
                await sock.readMessages([msg.key]);
                console.log(`Umesoma status ya: ${msg.pushName}`);
            }
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
            }
            return;
        }

        if (!global.botSettings.publicMode && !isOwner) return;

        // --- COMMANDS ---
        // Profile Picture FIX
        if (isOwner && body.startsWith(prefix + 'setpp')) {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted?.imageMessage) {
                try {
                    const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                    let buffer = Buffer.from([]);
                    for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    
                    await sock.updateProfilePicture(sock.user.id, buffer);
                    return sock.sendMessage(from, { text: "✅ *Profile Picture Updated Successfully!*" });
                } catch (e) {
                    return sock.sendMessage(from, { text: "❌ *Failed to update PP. Try another image.*" });
                }
            } else {
                return sock.sendMessage(from, { text: "❌ *Reply to an image with .setpp*" });
            }
        }

        // Mode commands
        if (isOwner && body === '.mode public') {
            global.botSettings.publicMode = true;
            return sock.sendMessage(from, { text: "✅ *Public Mode ON*" });
        }
        if (isOwner && body === '.mode self') {
            global.botSettings.publicMode = false;
            return sock.sendMessage(from, { text: "🔒 *Private Mode ON*" });
        }
    });
}

// Keep-alive kuzuia Render isizime
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 5 * 60 * 1000);

startNyoni();
