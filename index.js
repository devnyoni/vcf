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

// --- GLOBAL SETTINGS ---
global.botSettings = {
    publicMode: true,
    autoStatus: true,       // Auto view status
    autoStatusReact: true,  // Auto react emoji kwenye status
    statusEmoji: "🫡",      // Emoji unayotaka
    myUrl: "https://nyoni-md-free.onrender.com"
};

app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));

// Hii sehemu itatengeneza PAIRING CODE sasa hivi
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Weka namba! Mfano: /code?number=255xxxxxxxxx");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock) return res.status(500).send("Bot inaanza... subiri sekunde 10.");
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { res.status(500).send("WhatsApp Error."); }
});

app.listen(port);

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
        browser: ["Chrome (Linux)", "Nyoni-MD", "1.0.0"] 
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => startNyoni(), 5000); // Inawaka yenyewe
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        const from = msg.key.remoteJid;

        // --- AUTO STATUS VIEW & REACT ---
        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
            }
            return;
        }
        
        // Hapa bot itaanza kurespond meseji za kawaida
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        if (body.startsWith(prefix)) {
             // ... Command handler inakuja hapa
        }
    });
}
startNyoni();
