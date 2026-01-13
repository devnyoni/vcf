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
let sock = null;
let isConnecting = false;
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
    myUrl: process.env.RENDER_EXTERNAL_URL || "https://nyoni-md-free.onrender.com",
    antiSticker: true,
    stickerWarning: true,
    stickerTimeout: 5 * 60 * 1000,
    stickerBannedGroups: []
};

// --- STICKER VIOLATIONS ---
global.stickerViolations = new Map();

// --- PLUGIN LOADER ---
const plugins = new Map();
const pluginDescriptions = new Map();

function loadPlugins() {
    try {
        const pluginFolder = path.join(__dirname, 'plugins');
        if (!fs.existsSync(pluginFolder)) {
            fs.mkdirSync(pluginFolder, { recursive: true });
        }
        
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
                console.error(`Error loading plugin ${file}:`, e.message);
            }
        }
        console.log(`✅ Loaded ${plugins.size} plugins`);
        return plugins.size;
    } catch (error) {
        console.error('Failed to load plugins:', error.message);
        return 0;
    }
}

// --- STICKER PROTECTION ---
function checkStickerPermission(groupJid, userJid) {
    if (!global.botSettings.antiSticker) return true;
    if (global.botSettings.stickerBannedGroups.includes(groupJid)) return false;
    
    const violations = global.stickerViolations.get(userJid);
    if (violations && Date.now() - violations.lastViolation < global.botSettings.stickerTimeout) {
        return false;
    }
    return true;
}

async function handleStickerViolation(sock, msg, from, senderJid) {
    try {
        const violations = global.stickerViolations.get(senderJid) || { count: 0, lastViolation: 0 };
        violations.count++;
        violations.lastViolation = Date.now();
        global.stickerViolations.set(senderJid, violations);
        
        // Delete sticker
        await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
        
        if (global.botSettings.stickerWarning) {
            let warningMsg = `⚠️ *STICKER WARNING*\n\nUser: @${senderJid.split('@')[0]}\nWarning: ${violations.count}/3`;
            
            if (violations.count >= 3) {
                warningMsg += "\n🚫 *USER MUTED*";
                try {
                    await sock.groupParticipantsUpdate(from, [senderJid], 'restrict');
                } catch (muteError) {}
            }
            
            await sock.sendMessage(from, { 
                text: warningMsg,
                mentions: [senderJid]
            }, { quoted: msg }).catch(() => {});
        }
    } catch (error) {
        console.error('Error handling sticker violation:', error.message);
    }
}

// --- MENU GENERATOR ---
function generateAutoMenu() {
    const categories = {};
    
    pluginDescriptions.forEach((info, name) => {
        const cat = info.category;
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(name);
    });
    
    let menuText = `🚀 *NYONI-XMD BOT*\n\n`;
    
    for (const [category, commands] of Object.entries(categories)) {
        menuText += `*╭┈〔 ${category} 〕┈─*\n`;
        commands.forEach(cmd => {
            menuText += `┃ • ${prefix}${cmd}\n`;
        });
        menuText += `╰──────────────\n\n`;
    }
    
    menuText += `📊 *STATUS*\n`;
    menuText += `• Plugins: ${plugins.size}\n`;
    menuText += `• Anti-Sticker: ${global.botSettings.antiSticker ? '✅' : '❌'}\n`;
    
    return menuText;
}

// --- EXPRESS ROUTES ---
app.use(express.json());

// Home route - simple text
app.get('/', (req, res) => {
    res.send("NYONI-XMD BOT STATUS: ACTIVE 🚀\n\nUse /code?number=2557xxxxxxx to get pairing code");
});

// Pairing code route
app.get('/code', async (req, res) => {
    try {
        let num = req.query.number;
        if (!num) {
            return res.status(400).json({ error: "Number required: /code?number=2557xxxxxxx" });
        }
        
        num = num.replace(/[^0-9]/g, '');
        if (!num.startsWith('255') || num.length !== 12) {
            return res.status(400).json({ error: "Invalid Tanzanian number" });
        }
        
        if (!sock || !sock.user) {
            return res.status(503).json({ error: "Bot is starting, please wait 20 seconds" });
        }
        
        const code = await sock.requestPairingCode(num);
        
        res.json({ 
            success: true, 
            code: code,
            message: "Use this code in WhatsApp > Linked Devices"
        });
        
    } catch (error) {
        console.error('Pairing error:', error.message);
        res.status(500).json({ 
            error: "Failed to generate code",
            details: error.message 
        });
    }
});

// Status API
app.get('/status', (req, res) => {
    res.json({
        online: !!sock?.user?.id,
        plugins: plugins.size,
        settings: {
            antiSticker: global.botSettings.antiSticker,
            publicMode: global.botSettings.publicMode
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Server started on port ${port}`);
    startBot();
});

// --- BOT CORE ---
async function startBot() {
    if (isConnecting) {
        console.log('⏳ Already connecting...');
        return;
    }
    
    isConnecting = true;
    
    try {
        console.log('🤖 Starting NYONI-XMD Bot...');
        
        // Load plugins
        const pluginCount = loadPlugins();
        
        // Get auth state
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        console.log('🔐 Auth state loaded');
        
        // Get latest version
        const { version } = await fetchLatestBaileysVersion();
        
        // Create socket
        sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
            },
            printQRInTerminal: true,
            logger: pino({ level: "silent" }),
            browser: ["Windows 10", "Chrome", "120.0.0.0"],
            markOnlineOnConnect: true,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 60000
        });
        
        // Save credentials
        sock.ev.on('creds.update', saveCreds);
        
        // Handle connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                console.log('🔌 Connection closed');
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    console.log('🔄 Reconnecting in 10 seconds...');
                    setTimeout(() => {
                        isConnecting = false;
                        startBot();
                    }, 10000);
                } else {
                    console.log('❌ Logged out, please re-pair');
                    isConnecting = false;
                }
            } 
            else if (connection === 'open') {
                console.log('✅ Connected to WhatsApp!');
                console.log(`👤 User: ${sock.user?.id}`);
                isConnecting = false;
                
                // Send welcome message to owner
                try {
                    await sock.sendMessage(
                        jidNormalizedUser(sock.user.id), 
                        { text: `🚀 NYONI-XMD BOT ACTIVE!\n\nPlugins: ${pluginCount}` }
                    );
                } catch (e) {}
            }
            
            // Show QR if needed
            if (update.qr) {
                console.log('📱 QR Code received, scan with WhatsApp');
            }
        });
        
        // Handle messages
        sock.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const msg = messages[0];
                if (!msg.message) return;
                
                const from = msg.key.remoteJid;
                const isGroup = from?.endsWith('@g.us');
                
                // Handle stickers in groups
                if (isGroup && msg.message.stickerMessage && global.botSettings.antiSticker) {
                    const senderJid = msg.key.participant || from;
                    if (!checkStickerPermission(from, senderJid)) {
                        await handleStickerViolation(sock, msg, from, senderJid);
                        return;
                    }
                }
                
                // Handle status updates
                if (from === 'status@broadcast') {
                    if (global.botSettings.autoStatus) {
                        await sock.readMessages([msg.key]).catch(() => {});
                    }
                    if (global.botSettings.autoStatusReact) {
                        await sock.sendMessage(from, {
                            react: { text: global.botSettings.statusEmoji, key: msg.key }
                        }, { statusJidList: [msg.key.participant] }).catch(() => {});
                    }
                    return;
                }
                
                // Handle commands
                const body = msg.message.conversation || 
                            msg.message.extendedTextMessage?.text || 
                            msg.message.imageMessage?.caption || '';
                
                if (body?.startsWith(prefix)) {
                    const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
                    if (!global.botSettings.publicMode && !isOwner) return;
                    
                    const args = body.slice(prefix.length).trim().split(/ +/);
                    const commandName = args.shift().toLowerCase();
                    
                    // Send typing indicator
                    await sock.sendPresenceUpdate('composing', from).catch(() => {});
                    
                    // Handle menu command
                    if (commandName === 'menu') {
                        const menuText = generateAutoMenu();
                        await sock.sendMessage(from, {
                            image: { url: thumbUrl },
                            caption: menuText
                        }, { quoted: msg }).catch(() => {});
                        return;
                    }
                    
                    // Handle other commands
                    const plugin = plugins.get(commandName);
                    if (plugin) {
                        try {
                            await plugin.execute(sock, from, msg, args);
                        } catch (error) {
                            console.error(`Command error ${commandName}:`, error.message);
                        }
                    }
                }
            } catch (error) {
                console.error('Message handling error:', error.message);
            }
        });
        
        console.log('🤖 Bot setup complete, waiting for connection...');
        
    } catch (error) {
        console.error('❌ Bot startup failed:', error.message);
        console.log('🔄 Retrying in 30 seconds...');
        isConnecting = false;
        setTimeout(startBot, 30000);
    }
}

// Keep Render alive
setInterval(() => {
    if (global.botSettings.myUrl) {
        axios.get(`${global.botSettings.myUrl}/health`).catch(() => {});
    }
}, 5 * 60 * 1000);

// Start bot
startBot();
