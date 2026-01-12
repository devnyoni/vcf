 const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require('pino');

async function startNyoniXR() {
    const { state, saveCreds } = await useMultiFileAuthState('session');

    const conn = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' }),
        browser: ["Nyoni X-R", "Safari", "1.0.0"]
    });

    conn.ev.on('creds.update', saveCreds);

    // 1. AUTO VIEW & REACT STATUS
    conn.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        if (msg.key && msg.key.remoteJid === 'status@broadcast') {
            // View Status
            await conn.readMessages([msg.key]);
            
            // Auto Like Status (Reaction)
            await conn.sendMessage('status@broadcast', {
                react: { text: "❤️", key: msg.key }
            }, { statusJidList: [msg.key.participant] });
            
            console.log(`✅ Nyoni X-R: Viewed & Liked status ya ${msg.key.participant}`);
        }
    });

    // 2. GROUP MANAGER LOGIC
    conn.ev.on('group-participants.update', async (anu) => {
        console.log("Group update detected...");
        // Hapa unaweza kuweka kodi ya kukaribisha watu (Welcome Message)
    });

    conn.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('🚀 NYONI X-R IS ONLINE AND RUNNING!');
        }
    });
}

startNyoniXR();
