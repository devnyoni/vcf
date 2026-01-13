const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");

const app = express();
const port = process.env.PORT || 10000;
let sock;
const prefix = ".";

// --- SETTINGS ---
global.botSettings = {
    publicMode: true,
    autoStatus: true,       
    autoStatusReact: true,  
    statusEmoji: "🫡",      
};

app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));

// ENDPOINT YA PAIRING CODE
app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Weka namba! Mfano: /code?number=255xxxxxxxxx");
    
    num = num.replace(/[^0-9]/g, '');
    
    try {
        if (!sock) {
            return res.status(500).json({ error: "Bot engine is starting... please refresh in 10 seconds." });
        }
        
        // Hii ndio amri inayozalisha pairing code
        let code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) {
        console.error("Pairing Error:", err);
        res.status(500).json({ error: "Imeshindikana kupata pairing code. Hakikisha namba iko sawa." });
    }
});

app.listen(port, () => console.log(`Server inayumba kwenye port: ${port}`));

async function startNyoni() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();
    
    sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        printQRInTerminal: false, // Tumezima QR ili kutumia Pairing Code
        logger: pino({ level: "fatal" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"] // Muhimu kwa Pairing Code kufanya kazi
    });

    // Muhimu: Hii inasubiri creds zihifadhiwe
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Connection closed, reconnecting...");
                startNyoni(); 
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IMEUNGANISHWA!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;

        // AUTO STATUS VIEW & REACT
        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { 
                    react: { text: global.botSettings.statusEmoji, key: msg.key } 
                }, { statusJidList: [msg.key.participant] });
            }
        }
    });
}

startNyoni();
