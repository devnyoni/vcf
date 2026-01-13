const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    downloadContentFromMessage,
    Browsers
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

// --- GLOBAL SETTINGS (UWEZO MKUBWA) ---
global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,         // Inaonyesha Typing...
    autoRecord: true,       // Inaonyesha Recording...
    autoReact: true,        // Inajibu Emoji kwenye chat za kawaida
    autoStatus: true,       // Inasoma status
    autoStatusReact: true,  // Inajibu status kwa Emoji
    statusEmoji: "🫡",      
    myUrl: "https://nyoni-md-free.onrender.com"
};

app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Provide number!");
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
        browser: Browsers.macOS("Desktop"), // Browser ya kudumu zaidi
        syncFullHistory: false, // Inafanya iwe chap zaidi
        markOnlineOnConnect: global.botSettings.alwaysOnline
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Connection lost. Restarting...");
                setTimeout(() => startNyoni(), 3000); // Restart haraka zaidi (3sec)
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IS LIVE & FAST!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
            // --- AUTO STATUS VIEW & REACT (Chap) ---
            if (msg.key.remoteJid === 'status@broadcast') {
                if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
                if (global.botSettings.autoStatusReact) {
                    await sock.sendMessage(msg.key.remoteJid, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
                }
            }
            return;
        }

        const from = msg.key.remoteJid;
        const isOwner = msg.key.fromMe;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

        // --- AUTO TYPING / RECORDING / ONLINE ---
        if (global.botSettings.alwaysOnline) await sock.sendPresenceUpdate('available', from);
        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);
        if (global.botSettings.autoRecord) await sock.sendPresenceUpdate('recording', from);

        // --- AUTO REACT TO MESSAGES ---
        if (global.botSettings.autoReact && !isOwner) {
            await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
        }

        if (!global.botSettings.publicMode && !isOwner) return;

        // --- COMMANDS ---
        
        // Mode switch
        if (isOwner && body === '.mode public') {
            global.botSettings.publicMode = true;
            return sock.sendMessage(from, { text: "✅ *Public Mode ON*" });
        }
        if (isOwner && body === '.mode self') {
            global.botSettings.publicMode = false;
            return sock.sendMessage(from, { text: "🔒 *Private Mode ON*" });
        }

        // Fix PP Command
        if (isOwner && body.startsWith(prefix + 'setpp')) {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted?.imageMessage) {
                const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                await sock.updateProfilePicture(sock.user.id, buffer);
                return sock.sendMessage(from, { text: "✅ *Profile Picture Updated!*" });
            }
        }
    });
}

// Keep-alive ya nguvu (Render isizime)
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
    console.log("Ping sent to keep bot alive...");
}, 2 * 60 * 1000); // Kila baada ya dk 2

startNyoni();
