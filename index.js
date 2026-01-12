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

// --- 1. WEB SERVER KWA AJILI YA RENDER (PORT BINDING FIX) ---
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.status(200).send('NYONI-XMD IS RUNNING SUCCESSFULLY! ✅');
});

app.listen(port, () => {
    console.log(`Web server active on port ${port}`);
});

// --- 2. CONFIGURATION ---
const commands = new Map();
const prefix = ",";

async function startNyoni() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Nyoni-XMD", "Chrome", "20.0.04"]
    });

    // --- 3. PLUGIN LOADER ---
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) {
        fs.mkdirSync(pluginsPath);
    }

    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith(".js"));
    for (const file of pluginFiles) {
        try {
            const plugin = require(path.join(pluginsPath, file));
            commands.set(plugin.name, plugin);
            console.log(`Successfully loaded: ${plugin.name}`);
        } catch (e) {
            console.error(`Error loading ${file}:`, e);
        }
    }

    // --- 4. MESSAGE EVENT ---
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
                await sock.sendMessage(from, { text: "⚠️ Error executing command!" });
            }
        }
    });

    // --- 5. CONNECTION HANDLER ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNyoni();
        } else if (connection === 'open') {
            console.log('NYONI-XMD IS LIVE! 🚀');
            // Newsletter notification
            await sock.sendMessage("120363399470975987@newsletter", { 
                text: "NYONI-XMD IS NOW LIVE AND STABLE! 🚀" 
            });
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

// Anzisha Bot
startNyoni();
