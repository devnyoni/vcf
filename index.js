const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;
let sock;

// SERVER LOGIC (HTML & Pairing)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Weka namba!" });
    
    // Hapa bot inatengeneza pairing code
    try {
        let code = await sock.requestPairingCode(num);
        res.json({ code: code });
    } catch (err) {
        res.status(500).json({ error: "Imeshindikana" });
    }
});

// MAIN BOT LOGIC
async function startNyoni() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false, // Tunatumia Pairing Code badala yake
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // COMMANDS HAPA
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const command = body.toLowerCase();

        // 1. Command: Menu
        if (command === 'menu') {
            await sock.sendMessage(from, { text: "*NYONI-MD COMMANDS:*\n1. ping\n2. hi\n3. owner" });
        }

        // 2. Command: Ping
        if (command === 'ping') {
            await sock.sendMessage(from, { text: "Pong! Bot ipo Speed! ⚡" });
        }

        // 3. Command: Hi
        if (command === 'hi') {
            await sock.sendMessage(from, { text: "Habari! Mimi ni Nyoni-MD, nimezaliwa kufanya kazi!" });
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNyoni();
        } else if (connection === 'open') {
            console.log('BOT IMEUNGANISHWA TAYARI! ✅');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Anzisha kila kitu
app.listen(PORT, () => {
    console.log(`Server imewaka kwenye port ${PORT}`);
    startNyoni();
});
