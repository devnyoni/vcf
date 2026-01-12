const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    fetchLatestBaileysVersion 
} = require("@whiskeysockets/baileys");
const pino = require('pino');

async function startNyoni() {
    console.log(`
░█▄░█░█░█░█▀█░█▀█░▀█▀░░░▀▄░▄▀░█▀█
░█░▀█░▀▄▀░█░█░█░█░░█░░░░░▀▄▀░░█▀▄
░▀░░▀░░▀░░▀▀▀░▀░▀░▀▀▀░░░▀▄░▄▀░▀░▀
    NYONI X-R IS STARTING...
    `);

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const conn = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ["Nyoni X-R", "Safari", "1.0.0"]
    });

    conn.ev.on('creds.update', saveCreds);

    // AUTO STATUS VIEW & REACT
    conn.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            const mek = chatUpdate.messages[0];
            if (!mek.message) return;
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                
                // 1. View Status
                await conn.readMessages([mek.key]);
                
                // 2. Auto Like Status (Reaction ❤️)
                await conn.sendMessage('status@broadcast', {
                    react: { text: "❤️", key: mek.key }
                }, { statusJidList: [mek.key.participant] });
                
                console.log(`✅ Nyoni X-R: Viewed & Liked status ya ${mek.key.participant}`);
            }
        } catch (e) {
            console.log("Error logic: ", e);
        }
    });

    conn.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (connection === 'open') {
            console.log('🚀 NYONI X-R IS ONLINE! Status Booster Ready.');
        }
        if (qr) {
            console.log('👉 SCAN QR HII AU TUMIA PAIRING CODE KWENYE LOGS');
        }
    });
}

startNyoni();
