const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
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
const thumbUrl = "https://files.catbox.moe/t4ts87.jpeg";

// Global Settings
global.botSettings = {
    publicMode: true,
    alwaysOnline: true,
    autoType: true,
    autoStatus: true,
    autoStatusReact: true,
    statusEmoji: "🫡",
    myUrl: "https://nyoni-md-free.onrender.com"
};

// --- PLUGIN LOADER ---
const plugins = new Map();
function loadPlugins() {
    const pluginFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder);
    
    const files = fs.readdirSync(pluginFolder).filter(file => file.endsWith('.js'));
    plugins.clear();
    for (const file of files) {
        try {
            const command = require(`./plugins/${file}`);
            plugins.set(command.name, command);
        } catch (e) {
            console.error(`Error loading plugin ${file}:`, e);
        }
    }
    console.log(`✅ Loaded ${plugins.size} plugins!`);
}

app.use(express.static(path.join(__dirname, '.')));
app.get('/', (res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));

async function startNyoni() {
    loadPlugins();
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
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startNyoni(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IS LIVE!');
            const ownerJid = jidNormalizedUser(sock.user.id);
            await sock.sendMessage(ownerJid, { text: "🚀 *NYONI-XMD IMEUNGANISHWA!*" });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') {
            // Auto Status Logic
            if (msg.key.remoteJid === 'status@broadcast' && global.botSettings.autoStatus) {
                await sock.readMessages([msg.key]);
                if (global.botSettings.autoStatusReact) {
                    await sock.sendMessage(msg.key.remoteJid, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
                }
            }
            return;
        }

        const from = msg.key.remoteJid;
        const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        const isCmd = body.startsWith(prefix);
        const commandName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);

        if (isCmd) {
            if (!global.botSettings.publicMode && !isOwner) return;

            // 1. Auto React
            await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });

            // 2. Auto Typing
            if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);

            // 3. Handle Automatic Menu
            if (commandName === 'menu') {
                // Panga commands kwa makundi (Categories)
                const categories = {};
                plugins.forEach(p => {
                    const cat = p.category || "OTHER";
                    if (!categories[cat]) categories[cat] = [];
                    categories[cat].push(p.name);
                });

                let menuMsg = `🚀 *NYONI-XMD DASHBOARD*\n\n`;
                for (const [cat, cmds] of Object.entries(categories)) {
                    menuMsg += `*╭┈〔 🏠 ${cat.toUpperCase()} 〕┈─*\n`;
                    cmds.forEach(cmd => {
                        menuMsg += `┃ ✧ ${prefix}${cmd}\n`;
                    });
                    menuMsg += `╰──────────┈\n\n`;
                }

                return await sock.sendMessage(from, {
                    image: { url: thumbUrl },
                    caption: menuMsg
                }, { quoted: msg });
            }

            // 4. Handle Plugin Commands
            const cmd = plugins.get(commandName);
            if (cmd) {
                try {
                    // Kila command inatuma na picha kama thumbnail ukitaka
                    // (Hapa inaita execute function ya plugin yako)
                    await cmd.execute(sock, from, msg, args);
                } catch (e) {
                    console.error(e);
                }
            }
        }
    });
}

// Keep-alive
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 2 * 60 * 1000);

app.listen(port, () => console.log(`Server live on port ${port}`));
startNyoni();
