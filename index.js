const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const path = require("path");
const pino = require("pino");
const express = require("express");

const app = express();
const port = process.env.PORT || 10000;
let sock;

// 1. WEB SERVER FIX (Inaondoa "Not Found")
app.use(express.static(path.join(__dirname, '.')));

app.get('/', (req, res) => {
    // Hakikisha una file linaitwa index.html kwenye GitHub
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send({ error: "Weka namba!" });
    num = num.replace(/[^0-9]/g, '');
    if (!sock) return res.status(503).send({ error: "Bot inawaka..." });
    try {
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code });
    } catch (e) {
        res.status(500).json({ error: "Jaribu tena." });
    }
});

app.listen(port, () => console.log(`Server live on ${port}`));

// 2. BOT LOGIC
async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    sock = makeWASocket({
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'close') start();
        if (u.connection === 'open') console.log("NYONI-XMD CONNECTED! 🚀");
    });

    // 3. INSTANT COMMANDS (Inafanya bot "IREACT")
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        
        const prefix = "."; // Tumeweka DOTI ili iendane na picha yako

        if (body === `${prefix}ping`) {
            await sock.sendMessage(from, { text: "System Active! ⚡" });
        }
        if (body === `${prefix}menu`) {
            await sock.sendMessage(from, { text: "*NYONI-XMD MENU*\n\n.ping\n.alive\n.owner" });
        }
    });
}
start();
