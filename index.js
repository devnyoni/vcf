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

// --- GLOBAL SETTINGS (Fully Optimized) ---
global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,         // Inaonyesha 'typing...'
    autoRecord: false,      // Inaonyesha 'recording...' (Zima moja kati ya hizi)
    autoStatus: true,       // Inasoma status
    autoStatusReact: true,  // Inajibu status
    statusEmoji: "🫡",      // Emoji ya status
    myUrl: "https://nyoni-md-free.onrender.com" // WEKA URL YAKO HAPA
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
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    // --- CONNECTION UPDATE ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Connection lost. Restarting...");
                setTimeout(() => startNyoni(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IS LIVE!');
            
            // Tuma notification kwa Owner mara tu inapounganishwa
            const ownerJid = jidNormalizedUser(sock.user.id);
            await sock.sendMessage(ownerJid, { 
                text: "🚀 *NYONI-XMD IMEUNGANISHWA!*\n\n*Vipengele Vilivyowashwa:*\n✅ Auto Status View\n✅ Auto Status React\n✅ Always Online\n✅ Auto Typing\n\n*Muda:* Miezi 4 Active Mode.\n\n_Tumia .menu kuanza._" 
            });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
        
        // --- AUTO STATUS ---
        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) {
                await sock.readMessages([msg.key]);
            }
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
            }
            return;
        }

        // --- PRESENCE UPDATE (Typing Effect) ---
        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);
        if (global.botSettings.autoRecord) await sock.sendPresenceUpdate('recording', from);

        // --- COMMAND PARSING ---
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || "").trim();
        const isCmd = body.startsWith(prefix);
        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);

        if (!global.botSettings.publicMode && !isOwner) return;

        // --- COMMANDS ---
        if (isCmd) {
            // Auto React kwa kila command
            await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });

            switch (command) {
                case 'ping':
                    await sock.sendMessage(from, { text: "🚀 *NYONI-XMD Ipo Speed!*" }, { quoted: msg });
                    break;

                case 'mode':
                    if (!isOwner) return;
                    if (args[0] === 'public') {
                        global.botSettings.publicMode = true;
                        await sock.sendMessage(from, { text: "✅ *Mode imewekwa: PUBLIC*" });
                    } else if (args[0] === 'self') {
                        global.botSettings.publicMode = false;
                        await sock.sendMessage(from, { text: "🔒 *Mode imewekwa: SELF (PRIVATE)*" });
                    } else {
                        await sock.sendMessage(from, { text: "Tumia: .mode public au .mode self" });
                    }
                    break;

                case 'setpp':
                    if (!isOwner) return;
                    const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                    if (quoted?.imageMessage) {
                        try {
                            const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                            let buffer = Buffer.from([]);
                            for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                            await sock.updateProfilePicture(sock.user.id, buffer);
                            await sock.sendMessage(from, { text: "✅ *Profile Picture Updated!*" });
                        } catch (e) {
                            await sock.sendMessage(from, { text: "❌ *Error updating PP.*" });
                        }
                    } else {
                        await sock.sendMessage(from, { text: "❌ *Reply picha na .setpp*" });
                    }
                    break;

                case 'menu':
                    const menuText = `📂 *NYONI-XMD MENU*\n\n` +
                                   `1. .ping (Kuangalia kama bot ipo hai)\n` +
                                   `2. .mode public/self\n` +
                                   `3. .setpp (Weka PP mpya)\n\n` +
                                   `*Settings Status:*\n` +
                                   `- Public: ${global.botSettings.publicMode}\n` +
                                   `- Auto Status: ${global.botSettings.autoStatus}`;
                    await sock.sendMessage(from, { text: menuText }, { quoted: msg });
                    break;
            }
        }
    });
}

// Keep-alive kuzuia Render isilale (Muhimu kwa miezi 4)
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
    console.log("Keep-alive: Ping sent to " + global.botSettings.myUrl);
}, 2 * 60 * 1000); // Kila dakika 2

startNyoni();
