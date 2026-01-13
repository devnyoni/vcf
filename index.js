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

// --- CONFIGURATION ---
global.botSettings = {
    publicMode: true,
    autoStatus: true,       // Auto view status
    autoStatusReact: true,  // Auto react status
    statusEmoji: "🫡",      // Status reaction emoji
    myUrl: "https://nyoni-md-free.onrender.com"
};

app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Provide number!");
    num = num.replace(/[^0-9]/g, '');
    try {
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { res.status(500).send("WhatsApp Error."); }
});
app.listen(port);

// --- PLUGIN LOADER (Fixed) ---
const commands = new Map();
function loadPlugins() {
    const pluginsPath = path.join(__dirname, 'plugins');
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

    loadPlugins();
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startNyoni(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD CONNECTED!');
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
        if (!body.startsWith(prefix)) return;

        const args = body.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        
        // --- COMMAND HANDLER ---
        const plugin = commands.get(cmdName);
        if (plugin) {
            try {
                await plugin.execute(sock, from, msg, args);
            } catch (e) { console.error(e); }
        }

        // --- PROFILE PICTURE CMD (.setpp) ---
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
    });
}

// Keep-alive for Render
setInterval(() => { axios.get(global.botSettings.myUrl).catch(() => {}); }, 5 * 60 * 1000);

startNyoni();
