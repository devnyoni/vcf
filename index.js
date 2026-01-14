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
    myUrl: "https://nyoni-md-free.onrender.com",
    antiSticker: true,
    stickerWarning: true,
    stickerTimeout: 5 * 60 * 1000,
    stickerBannedGroups: []
};

// --- PLUGIN LOADER ---
const plugins = new Map();
const pluginDescriptions = new Map();

function loadPlugins() {
    const pluginFolder = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginFolder)) fs.mkdirSync(pluginFolder, { recursive: true });
    
    const files = fs.readdirSync(pluginFolder).filter(file => file.endsWith('.js'));
    plugins.clear();
    pluginDescriptions.clear();
    
    for (const file of files) {
        try {
            delete require.cache[require.resolve(`./plugins/${file}`)];
            const command = require(`./plugins/${file}`);
            
            if (command.name) {
                plugins.set(command.name, command);
                pluginDescriptions.set(command.name, {
                    description: command.description || "No description",
                    category: command.category || "GENERAL",
                    usage: command.usage || command.name
                });
            }
        } catch (e) {
            console.error(`Error loading plugin ${file}:`, e);
        }
    }
    console.log(`✅ Loaded ${plugins.size} plugins automatically!`);
}

// --- AUTOMATIC MENU GENERATOR (UREMBO MPYA) ---
function generateAutoMenu() {
    const categories = {};
    
    pluginDescriptions.forEach((info, name) => {
        const cat = info.category;
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(name);
    });
    
    let menuText = `🚀 *NYONI-XMD AUTOMATIC MENU*\n\n`;
    
    for (const [category, commands] of Object.entries(categories)) {
        menuText += `*╭┈〔 💞 ${category.toUpperCase()} 〕┈─*\n`;
        commands.forEach(cmd => {
            menuText += `┃ ✧ \`${prefix}${cmd}\`\n`;
        });
        menuText += `╰──────────┈──\n\n`;
    }
    
    menuText += `📊 *SYSTEM STATUS*\n`;
    menuText += `✧ Plugins: ${plugins.size}\n`;
    menuText += `✧ Public: ${global.botSettings.publicMode ? '✅' : '❌'}\n`;
    menuText += `✧ Anti-Sticker: ${global.botSettings.antiSticker ? '✅' : '❌'}\n`;
    
    return menuText;
}

// --- HELP COMMAND GENERATOR ---
function generateHelp(commandName) {
    if (!plugins.has(commandName)) {
        return `❌ Command "${commandName}" not found!\nUse ${prefix}menu to see all available commands.`;
    }
    
    const command = plugins.get(commandName);
    const info = pluginDescriptions.get(commandName);
    
    let helpText = `╭───『 📘 𝐇𝐄𝐋𝐏: ${prefix}${commandName.toUpperCase()} 』\n`;
    helpText += `│\n`;
    helpText += `│ 📝 *Description:* ${info.description}\n`;
    helpText += `│ 🏷️ *Category:* ${info.category}\n`;
    helpText += `│ 📌 *Usage:* ${prefix}${info.usage}\n`;
    
    if (command.examples) {
        helpText += `│\n│ 📚 *Examples:*\n`;
        command.examples.forEach(example => {
            helpText += `│   └─ ${prefix}${example}\n`;
        });
    }
    
    if (command.aliases && command.aliases.length > 0) {
        helpText += `│\n│ 🔤 *Aliases:* ${command.aliases.map(a => `${prefix}${a}`).join(', ')}\n`;
    }
    
    helpText += `╰──────────────────────────\n`;
    
    return helpText;
}

// --- STICKER PROTECTION SYSTEM ---
const stickerViolations = new Map();

function checkStickerPermission(groupJid, userJid) {
    if (!global.botSettings.antiSticker) return true;
    if (global.botSettings.stickerBannedGroups.includes(groupJid)) return false;
    
    const violations = stickerViolations.get(userJid);
    if (violations && Date.now() - violations.lastViolation < global.botSettings.stickerTimeout) {
        return false;
    }
    return true;
}

async function handleStickerViolation(sock, msg, from, senderJid) {
    const violations = stickerViolations.get(senderJid) || { count: 0, lastViolation: 0 };
    violations.count++;
    violations.lastViolation = Date.now();
    stickerViolations.set(senderJid, violations);
    
    if (global.botSettings.stickerWarning) {
        const warnings = violations.count;
        let action = warnings >= 3 ? `⏳ Muted for ${global.botSettings.stickerTimeout / (60 * 1000)} minutes` : "";
        
        const warningMsg = `⚠️ *STICKER WARNING*\n\nUser: @${senderJid.split('@')[0]}\nWarning #${warnings}\n${action}`;
        await sock.sendMessage(from, { text: warningMsg, mentions: [senderJid] }, { quoted: msg });
    }
    try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
}

// --- EXPRESS ROUTES & UPTIME KEEP-ALIVE ---
app.use(express.static(path.join(__dirname, '.')));

// Improved Health-Check for UptimeRobot
app.get('/', (req, res) => {
    res.status(200).json({
        status: "Active",
        bot: "NYONI-XMD",
        uptime: process.uptime()
    });
});

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Enter number!");
    num = num.replace(/[^0-9]/g, '');
    try {
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { res.status(500).json({ error: "WhatsApp Error." }); }
});

app.get('/plugins', (req, res) => {
    res.json({ total: plugins.size, plugins: Array.from(plugins.keys()) });
});

app.listen(port, () => console.log(`🚀 Host Server live on port ${port}`));

// High-Frequency Self-Ping (Every 30 seconds) to prevent sleep
setInterval(async () => {
    try {
        await axios.get(global.botSettings.myUrl);
        console.log("⚓ Uptime Check: Bot is awake.");
    } catch (e) {
        console.log("⚓ Uptime Check: Ping sent to host.");
    }
}, 30000); 

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
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) setTimeout(() => startNyoni(), 5000);
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IS LIVE!');
            await sock.sendMessage(jidNormalizedUser(sock.user.id), { text: "🚀 *NYONI-XMD CONNECTED!*" });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        if (isGroup && msg.message.stickerMessage && global.botSettings.antiSticker) {
            const senderJid = msg.key.participant || msg.key.remoteJid;
            if (!checkStickerPermission(from, senderJid)) {
                await handleStickerViolation(sock, msg, from, senderJid);
                return;
            }
        }

        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { react: { text: global.botSettings.statusEmoji, key: msg.key } }, { statusJidList: [msg.key.participant] });
            }
            return;
        }

        const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.videoMessage?.caption || "").trim();
        const isCmd = body.startsWith(prefix);
        const commandName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);

        if (isCmd) {
            if (!global.botSettings.publicMode && !isOwner) return;

            if (commandName === 'menu' || commandName === 'help' && !args[0]) {
                loadPlugins();
                const menuText = generateAutoMenu();
                return await sock.sendMessage(from, { image: { url: thumbUrl }, caption: menuText }, { quoted: msg });
            }
            
            if (commandName === 'help' && args[0]) {
                return await sock.sendMessage(from, { text: generateHelp(args[0].toLowerCase()) }, { quoted: msg });
            }

            const plugin = plugins.get(commandName);
            if (plugin) {
                try {
                    await plugin.execute(sock, from, msg, args);
                } catch (err) {
                    await sock.sendMessage(from, { text: `❌ Error executing ${prefix}${commandName}` });
                }
            }
        }
    });
}

startNyoni().catch(err => {
    setTimeout(() => startNyoni(), 10000);
});
