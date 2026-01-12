const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 10000;
let sock;

// 1. WEB SERVER
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Weka namba" });
    
    // Safisha namba (Ondoa +, nafasi, n.k)
    num = num.replace(/[^0-9]/g, '');

    try {
        if (!sock) return res.json({ error: "Subiri kidogo bot inawaka..." });
        let code = await sock.requestPairingCode(num);
        res.json({ code: code });
    } catch (err) {
        res.status(500).json({ error: "Error upande wa server" });
    }
});

// 2. BOT LOGIC
async function startBot() {
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

    // COMMANDS
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();

        if (text === 'ping') {
            await sock.sendMessage(from, { text: 'Bot ipo hewani! ✅' });
        }
        if (text === 'menu') {
            await sock.sendMessage(from, { text: '*NYONI-MD MENU*\n- ping\n- hi\n- owner' });
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('CONNECTED! ✅');
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// 3. START EVERYTHING
app.listen(PORT, () => {
    console.log(`Server: http://localhost:${PORT}`);
    startBot();
});
