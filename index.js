const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const express = require("express");

const app = express();
const port = process.env.PORT || 10000;

// Serve static files
app.use(express.static(path.join(__dirname, '.')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// PAIRING CODE ENDPOINT WITH AUTO-RETRY
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Phone number is required" });
    num = num.replace(/[^0-9]/g, '');

    if (!sock || !sock.requestPairingCode) {
        return res.status(503).json({ error: "Bot is still starting. Please wait 10 seconds and try again." });
    }

    try {
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) {
        console.error("Pairing Error:", err);
        res.status(500).json({ error: "Server Busy. Click 'Generate' again." });
    }
});

app.listen(port, () => {
    console.log(`Web server active on port ${port}`);
});

let sock;
const commands = new Map();
const prefix = ",";

async function startNyoni() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Nyoni-XMD", "Chrome", "20.0.04"]
    });

    // Load Plugins
    const pluginsPath = path.join(__dirname, 'plugins');
    if (fs.existsSync(pluginsPath)) {
        fs.readdirSync(pluginsPath).forEach(file => {
            if (file.endsWith(".js")) {
                try {
                    const plugin = require(path.join(pluginsPath, file));
                    commands.set(plugin.name, plugin);
                } catch (e) {
                    console.error(`Plugin error: ${file}`, e);
                }
            }
        });
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNyoni();
        } else if (connection === 'open') {
            console.log('NYONI-XMD CONNECTED! 🚀');
            await sock.sendMessage("120363399470975987@newsletter", { 
                text: "NYONI-XMD IS ONLINE! 🚀\nPrefix: ,\nOwner: Nyoni-xmd" 
            });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

        if (!body.startsWith(prefix)) return;
        const args = body.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();

        const plugin = commands.get(cmdName);
        if (plugin) {
            try {
                await plugin.execute(sock, from, msg, args, commands);
            } catch (err) {
                console.error(err);
            }
        }
    });
}

startNyoni();
