const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay 
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const express = require('express');
const app = express();
const port = process.env.PORT || 10000; // Render port

// --- SERVER YA KUZUIA BOT ISIZIME ---
app.get('/', (req, res) => {
    res.send('NYONI X-R IS RUNNING SUCCESSFULLY! 🚀');
});

app.listen(port, () => {
    console.log(`Server is live on port ${port}`);
});

// --- ENGINE YA BOT ---
async function startNyoni() {
    console.log(`
░█▄░█░█░█░█▀█░█▀█░▀█▀░░░▀▄░▄▀░█▀█
░█░▀█░▀▄▀░█░█░█░█░░█░░░░░▀▄▀░░█▀▄
░▀░░▀░░▀░░▀▀▀░▀░▀░▀▀▀░░░▀▄░▄▀░▀░▀
      NYONI X-R IS STARTING...
    `);

    const { state, saveCreds } = await useMultiFileAuthState('session');

    const conn = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Hii itatoa Pairing Code kwenye logi zako
        logger: pino({ level: 'silent' }),
        browser: ["Nyoni X-R", "Chrome", "1.0.0"]
    });

    conn.ev.on('creds.update', saveCreds);

    // AUTO VIEW & REACT LOGIC
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;
        if (msg.key && msg.key.remoteJid === 'status@broadcast') {
            await conn.readMessages([msg.key]);
            await conn.sendMessage('status@broadcast', {
                react: { text: "❤️", key: msg.key }
            }, { statusJidList: [msg.key.participant] });
            console.log(`✅ Viewed & Liked: ${msg.key.participant}`);
        }
    });

    conn.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (connection === 'open') {
            console.log('🚀 NYONI X-R IS ONLINE AND READY!');
        }
        if (connection === 'close') {
            console.log('Connection closed. Restarting...');
            startNyoni();
        }
    });
}

startNyoni();
