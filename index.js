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
            // Clear cache for hot-reload
            delete require.cache[require.resolve(`./plugins/${file}`)];
            const command = require(`./plugins/${file}`);
            
            if (command.name) {
                plugins.set(command.name, command);
                
                // Store description for menu
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

// --- AUTOMATIC MENU GENERATOR ---
function generateAutoMenu() {
    const categories = {};
    
    // Organize plugins by category
    pluginDescriptions.forEach((info, name) => {
        const cat = info.category;
        if (!categories[cat]) {
            categories[cat] = [];
        }
        categories[cat].push({
            name: name,
            description: info.description,
            usage: info.usage
        });
    });
    
    let menuText = `╭───『 🚀 𝐍𝐘𝐎𝐍𝐈-𝐗𝐌𝐃 𝐀𝐔𝐓𝐎𝐌𝐀𝐓𝐈𝐂 𝐌𝐄𝐍𝐔 』\n`;
    
    for (const [category, commands] of Object.entries(categories)) {
        menuText += `│\n│ ⭐ *${category.toUpperCase()}*\n`;
        
        commands.forEach(cmd => {
            menuText += `│  └─ • ${prefix}${cmd.name}\n`;
        });
    }
    
    menuText += `│\n│ 📊 *STATUS*\n`;
    menuText += `│  ├─ • Plugins: ${plugins.size}\n`;
    menuText += `│  ├─ • Prefix: ${prefix}\n`;
    menuText += `│  ├─ • Anti-Sticker: ${global.botSettings.antiSticker ? '✅' : '❌'}\n`;
    menuText += `│  └─ • Public Mode: ${global.botSettings.publicMode ? '✅' : '❌'}\n`;
    menuText += `│\n│ 💡 *TIPS*\n`;
    menuText += `│  • Use ${prefix}help [command] for details\n`;
    menuText += `│  • Commands auto-update when added\n`;
    menuText += `╰──────────────────────────\n`;
    
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
    const groupMetadata = await sock.groupMetadata(from).catch(() => null);
    const violations = stickerViolations.get(senderJid) || { count: 0, lastViolation: 0 };
    
    violations.count++;
    violations.lastViolation = Date.now();
    stickerViolations.set(senderJid, violations);
    
    if (global.botSettings.stickerWarning) {
        const warnings = violations.count;
        let action = "";
        
        if (warnings >= 3) {
            try {
                await sock.groupParticipantsUpdate(from, [senderJid], 'restrict');
                action = `⏳ Muted for ${global.botSettings.stickerTimeout / (60 * 1000)} minutes`;
            } catch (e) {
                console.error("Failed to mute user:", e);
            }
        }
        
        const warningMsg = `⚠️ *STICKER WARNING*\n\n` +
                          `User: @${senderJid.split('@')[0]}\n` +
                          `Warning #${warnings}\n` +
                          `${action}\n\n` +
                          `_Stickers are disabled in this group._`;
        
        await sock.sendMessage(from, { 
            text: warningMsg,
            mentions: [senderJid]
        }, { quoted: msg });
    }
    
    try {
        await sock.sendMessage(from, { delete: msg.key });
    } catch (e) {
        console.error("Failed to delete sticker:", e);
    }
}

// --- EXPRESS ROUTES ---
app.use(express.static(path.join(__dirname, '.')));
app.get('/', (req, res) => res.send("NYONI-XMD STATUS: ACTIVE 🚀"));

app.get('/code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.status(400).send("Enter number! Example: /code?number=255xxxxxxxxx");
    num = num.replace(/[^0-9]/g, '');
    try {
        if (!sock) {
            return res.status(500).json({ error: "Bot is still starting, try again after 10 seconds." });
        }
        const code = await sock.requestPairingCode(num);
        res.status(200).json({ code: code });
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "WhatsApp Error or Wrong Number." }); 
    }
});

// API to see loaded plugins
app.get('/plugins', (req, res) => {
    const pluginList = Array.from(plugins.keys());
    res.json({
        total: plugins.size,
        plugins: pluginList,
        categories: Object.fromEntries(
            Array.from(pluginDescriptions.entries())
                .reduce((acc, [name, info]) => {
                    if (!acc[info.category]) acc[info.category] = [];
                    acc[info.category].push(name);
                    return acc;
                }, {})
        )
    });
});

app.listen(port, () => console.log(`Server live on port ${port}`));

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
            if (reason !== DisconnectReason.loggedOut) {
                console.log("Connection lost. Restarting...");
                setTimeout(() => startNyoni(), 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ NYONI-XMD IS LIVE!');
            console.log(`📁 Loaded ${plugins.size} plugins automatically`);
            
            const ownerJid = jidNormalizedUser(sock.user.id);
            await sock.sendMessage(ownerJid, { 
                text: "🚀 *NYONI-XMD CONNECTED!*\n\n" +
                      `📊 *Automatic Menu System Active*\n` +
                      `• Plugins Loaded: ${plugins.size}\n` +
                      `• Prefix: ${prefix}\n` +
                      `• Auto-reload: ✅ Enabled\n` +
                      `\nCommands will auto-appear in menu!`
            });
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        
        // --- ANTI-STICKER SYSTEM ---
        if (isGroup && msg.message.stickerMessage && global.botSettings.antiSticker) {
            const senderJid = msg.key.participant || msg.key.remoteJid;
            
            if (!checkStickerPermission(from, senderJid)) {
                await handleStickerViolation(sock, msg, from, senderJid);
                return;
            }
        }

        // --- AUTO STATUS VIEW/REACT ---
        if (from === 'status@broadcast') {
            if (global.botSettings.autoStatus) await sock.readMessages([msg.key]);
            if (global.botSettings.autoStatusReact) {
                await sock.sendMessage(from, { 
                    react: { 
                        text: global.botSettings.statusEmoji, 
                        key: msg.key 
                    } 
                }, { 
                    statusJidList: [msg.key.participant] 
                });
            }
            return;
        }

        const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
        const body = (msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     msg.message.videoMessage?.caption || "").trim();
        const isCmd = body.startsWith(prefix);
        const commandName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : "";
        const args = body.trim().split(/ +/).slice(1);

        if (isCmd) {
            if (!global.botSettings.publicMode && !isOwner) return;

            // Auto React & Typing
            await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } });
            if (global.botSettings.autoType) await sock.sendPresenceUpdate('composing', from);

            // 🔄 AUTOMATIC MENU SYSTEM
            if (commandName === 'menu' || commandName === 'help' && !args[0]) {
                // Reload plugins in case new ones were added
                loadPlugins();
                
                const menuText = generateAutoMenu();
                return await sock.sendMessage(from, { 
                    image: { url: thumbUrl }, 
                    caption: menuText 
                }, { quoted: msg });
            }
            
            // 📘 HELP FOR SPECIFIC COMMAND
            if (commandName === 'help' && args[0]) {
                const helpCommand = args[0].toLowerCase();
                const helpText = generateHelp(helpCommand);
                return await sock.sendMessage(from, { 
                    text: helpText 
                }, { quoted: msg });
            }
            
            // 📊 PLUGINS COMMAND
            if (commandName === 'plugins' || commandName === 'cmd') {
                loadPlugins(); // Reload to get latest
                
                let pluginList = "📁 *AUTO-LOADED PLUGINS*\n\n";
                pluginDescriptions.forEach((info, name) => {
                    pluginList += `• ${prefix}${name} (${info.category})\n`;
                });
                
                pluginList += `\n✅ Total: ${plugins.size} commands\n`;
                pluginList += `🔄 Auto-reloads when new plugins are added`;
                
                return await sock.sendMessage(from, { 
                    text: pluginList 
                }, { quoted: msg });
            }
            
            // 🔄 RELOAD COMMANDS
            if (commandName === 'reload' && isOwner) {
                const oldCount = plugins.size;
                loadPlugins();
                const newCount = plugins.size;
                
                const added = newCount - oldCount;
                const message = added > 0 
                    ? `🔄 Reloaded! ${added} new plugin(s) added.\nTotal: ${newCount} commands`
                    : `🔄 Reloaded! ${newCount} plugins loaded.`;
                
                return await sock.sendMessage(from, { 
                    text: message 
                }, { quoted: msg });
            }

            // 🛠️ PLUGIN HANDLER (AUTOMATIC)
            const plugin = plugins.get(commandName);
            if (plugin) {
                try {
                    // Check admin for admin-only commands
                    if (plugin.adminOnly && isGroup) {
                        const metadata = await sock.groupMetadata(from);
                        const isAdmin = metadata.participants.find(p => p.id === (msg.key.participant || from))?.admin;
                        if (!isAdmin && !isOwner) {
                            return await sock.sendMessage(from, { 
                                text: "❌ This command is for admins only!" 
                            });
                        }
                    }
                    
                    await plugin.execute(sock, from, msg, args);
                } catch (err) {
                    console.error(`Error in plugin ${commandName}:`, err);
                    await sock.sendMessage(from, { 
                        text: `❌ Error executing ${prefix}${commandName}`
                    });
                }
            } else if (isCmd) {
                // Command not found
                await sock.sendMessage(from, { 
                    text: `❌ Command "${commandName}" not found!\n` +
                          `Use ${prefix}menu to see all available commands.`
                });
            }
        }
    });
}

// Keep-alive
setInterval(() => {
    axios.get(global.botSettings.myUrl).catch(() => {});
}, 2 * 60 * 1000);

// Start bot
startNyoni().catch(err => {
    console.error('Failed to start bot:', err);
    setTimeout(() => startNyoni(), 10000);
});
