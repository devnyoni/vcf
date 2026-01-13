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

// --- SETTINGS ---
global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,
    autoReact: true,
    autoStatus: true,
    chatbot: true,
    myUrl: "https://nyoni-md-free.onrender.com" // Link yako ya Render
};

app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => res.send("NYONI-XMD STATUS: RUNNING ✅"));

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Weka namba! Mfano: /code?number=255xxxxxxxxx");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock) return res.status(500).send("Bot engine starting...");
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { res.status(500).send("WhatsApp Error."); }
});

app.listen(port, () => console.log(`Server live on port ${port}`));

async function startNyoni() {
    // Kutumia folder la 'session' uliloweka GitHub
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

    // --- MFUMO WA KURECONNECT ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Connection lost. Reconnecting in 5 seconds...");
                setTimeout(() => startNyoni(), 5000);
            } else {
                console.log("Logged out! Futa session u-pair upya.");
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD CONNECTED!');
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

        // --- COMMANDS ---
        if (isOwner && body === '.mode public') {
            global.botSettings.publicMode = true;
            return sock.sendMessage(from, { text: "✅ *Mode updated to PUBLIC.*" });
        }
        if (isOwner && body === '.mode self') {
            global.botSettings.publicMode = false;
            return sock.sendMessage(from, { text: "🔒 *Mode updated to PRIVATE.*" });
        }

        if (isOwner && body === '.setpp') {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted?.imageMessage) {
                const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                await sock.updateProfilePicture(sock.user.id, buffer);
                return sock.sendMessage(from, { text: "✅ *Profile picture updated!*" });
            }
        }
    });
}

// Keep-alive ping kila dakika 5 kuzuia Render isilale
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 5 * 60 * 1000);

startNyoni();
