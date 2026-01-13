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

const app = express();
const port = process.env.PORT || 10000;
let sock;
const prefix = ".";

// --- 1. GLOBAL SETTINGS ---
global.botSettings = {
    publicMode: true,    // Kweli = Kila mtu, Si kweli = Wewe tu
    alwaysOnline: true,  // Bot ionekane online kila wakati
    autoType: true,      // "typing..." kila ujumbe ukiingia
    autoRecord: false,   // "recording..." (Zima kwa default)
    autoReact: true,     // React ya kiotomatiki 🤖
    autoStatus: true,    // Kuangalia status za watu kiotomatiki
    chatbot: true        // Chatbot iko hewani
};

// --- 2. PAIRING SERVER (Kwa ajili ya Render) ---
app.use(express.static(path.join(__dirname, '.')));
app.get('/code', async (req, res) => {
    let num = req.query.number?.replace(/[^0-9]/g, '');
    if (!num) return res.status(400).json({ error: "Number required" });
    try {
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code });
    } catch (err) { res.status(500).json({ error: "Error" }); }
});
app.listen(port, () => console.log(`Server live on port ${port}`));

// --- 3. PLUGIN LOADER ---
const commands = new Map();
function loadPlugins() {
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);
    const files = fs.readdirSync(pluginsPath).filter(f => f.endsWith('.js'));
    for (const file of files) {
        try {
            const plugin = require(`./plugins/${file}`);
            if (plugin.name) commands.set(plugin.name, plugin);
        } catch (e) { console.log(`Error loading ${file}`); }
    }
}

// --- 4. START NYONI-XMD ---
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
        browser: ["Nyoni-XMD", "Chrome", "20.0.04"]
    });

    loadPlugins();
    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (u) => {
        if (u.connection === 'close') startNyoni();
        if (u.connection === 'open') console.log('NYONI-XMD IS LIVE! 🚀');
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
            if (msg.key.remoteJid === 'status@broadcast' && global.botSettings.autoStatus) {
                await sock.readMessages([msg.key]); // View Status Automatically
            }
            return;
        }

        const from = msg.key.remoteJid;
        const isOwner = msg.key.fromMe;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isCmd = body.startsWith(prefix);

        // --- PUBLIC/PRIVATE PROTECTION ---
        if (!global.botSettings.publicMode && !isOwner) return;

        // --- AUTOMATION ACTIONS ---
        if (global.botSettings.alwaysOnline) await sock.sendPresenceUpdate('available', from);
        if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);
        if (global.botSettings.autoReact) await sock.sendMessage(from, { react: { text: "🤖", key: msg.key } });

        // --- SPECIAL COMMANDS (Inside Index) ---
        if (isOwner && body === '.mode public') {
            global.botSettings.publicMode = true;
            return sock.sendMessage(from, { text: "✅ Mode: PUBLIC (Kila mtu anaweza kunitumia)" });
        }
        if (isOwner && body === '.mode self') {
            global.botSettings.publicMode = false;
            return sock.sendMessage(from, { text: "🔒 Mode: SELF (Ni Boss tu anaruhusiwa)" });
        }

        // --- PROFILE PICTURE SETTER (.setpp) ---
        if (isOwner && body === '.setpp') {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted?.imageMessage) {
                const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                await sock.updateProfilePicture(sock.user.id, buffer); // Change Profile Picture
                return sock.sendMessage(from, { text: "✅ Picha ya Bot imebadilishwa!" });
            }
        }

        // --- CHATBOT LOGIC ---
        if (!isCmd && global.botSettings.chatbot && body.length > 0) {
            const input = body.toLowerCase();
            if (input.includes("mambo")) return sock.sendMessage(from, { text: "Poa sana! Mimi ni Nyoni-XMD, nisaidie nini?" });
            if (input.includes("nyoni")) return sock.sendMessage(from, { text: "Ndiyo, nipo hapa! ⚡" });
        }

        // --- COMMAND HANDLER ---
        if (!isCmd) return;
        const args = body.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();
        const plugin = commands.get(cmdName);
        if (plugin) {
            try { await plugin.execute(sock, from, msg, args, commands); }
            catch (e) { console.error(e); }
        }
    });
}
startNyoni();
