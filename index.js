const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const path = require("path");
const pino = require("pino");
const express = require("express");

// --- WEB SERVER ---
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('NYONI-XMD IS RUNNING SUCCESSFULLY! ✅');
});

app.listen(port, () => {
    console.log(`Server is active on port ${port}`);
});

// --- BOT START ---
async function startNyoni() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Nyoni-XMD", "Safari", "3.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNyoni();
        } else if (connection === 'open') {
            console.log('NYONI-XMD CONNECTED! 🚀');
        }
    });

    // --- INTERNAL COMMANDS (PLUGINS INSIDE) ---
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const prefix = ",";

        if (!body.startsWith(prefix)) return;

        const args = body.slice(prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // 1. PING COMMAND
        if (command === 'ping') {
            await sock.sendMessage(from, { text: "I am Active! Speed: 100% ⚡" });
        }

        // 2. ALIVE COMMAND
        if (command === 'alive') {
            await sock.sendMessage(from, { 
                text: "Hello! NYONI-XMD is currently online and stable. 🚀" 
            });
        }

        // 3. MENU COMMAND
        if (command === 'menu') {
            let menuText = `*NYONI-XMD MAIN MENU*\n\n` +
                           `*Prefix:* [ ${prefix} ]\n` +
                           `*Owner:* Nyoni-xmd\n\n` +
                           `*COMMANDS:*\n` +
                           `✧ ${prefix}ping\n` +
                           `✧ ${prefix}alive\n` +
                           `✧ ${prefix}owner\n` +
                           `✧ ${prefix}restart\n\n` +
                           `_Keep using NYONI-XMD!_`;
            
            await sock.sendMessage(from, { text: menuText });
        }

        // 4. OWNER COMMAND
        if (command === 'owner') {
            await sock.sendMessage(from, { text: "My owner is Nyoni-xmd. Contact: 255610209120" });
        }
    });
}

startNyoni();
