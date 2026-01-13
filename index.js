const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    downloadContentFromMessage,
    jidNormalizedUser
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

// --- GLOBAL SETTINGS (Boresha hapa) ---
global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,         // Inaonyesha 'typing...'
    autoRecord: true,       // Inaonyesha 'recording...'
    autoReact: true,
    autoStatus: true,       
    autoStatusReact: true,  
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
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: global.botSettings.alwaysOnline // Always Online
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Reconnecting...");
                setTimeout(() => startNyoni(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IS LIVE!');
            // Notification ya kuunganishwa
            const msg = `🚀 *NYONI-XMD CONNECTED!*\n\n*Status:* Active\n*Mode:* ${global.botSettings.publicMode ? 'Public' : 'Self'}\n*Duration:* 4 Months (Stay Active)`;
            await sock.sendMessage(sock.user.id, { text: msg });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
            // Handle Status Updates
            if (msg.key.remoteJid === 'status@broadcast' && global.botSettings.autoStatus) {
                await sock.readMessages([msg.key]);
                if (global.botSettings.autoStatusReact) {
                    await sock.sendMessage('status@broadcast', { 
                        react: { text: global.botSettings.statusEmoji, key: msg.key } 
                    }, { statusJidList: [msg.key.participant] });
                }
            }
            return;
        }

        const from = msg.key.remoteJid;
        
        // --- AUTO PRESENCE (Typing/Recording) ---
        if (global.botSettings.autoType) {
            await sock.sendPresenceUpdate('composing', from);
        } else if (global.botSettings.autoRecord) {
            await sock.sendPresenceUpdate('recording', from);
        }

        const isOwner = msg.key.fromMe;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

        if (!global.botSettings.publicMode && !isOwner) return;

        // --- COMMANDS ---
        if (isOwner && body.startsWith(prefix + 'setpp')) {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted?.imageMessage) {
                const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                await sock.updateProfilePicture(sock.user.id, buffer);
                return sock.sendMessage(from, { text: "✅ PP Updated!" });
            }
        }

        // Fix mode command
        if (isOwner && body === '.mode public') {
            global.botSettings.publicMode = true;
            return sock.sendMessage(from, { text: "✅ Public Mode ON" });
        }
    });
}

// Keep-alive (Mhimu kwa Render/Uptime)
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 3 * 60 * 1000); // Kila dakika 3

startNyoni();
