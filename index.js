const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const pino = require("pino");

// Map ya kuhifadhi commands
const commands = new Map();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "fatal" })
    });

    // --- SEHEMU YA KUSOMA PLUGINS ---
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

    const pluginFiles = fs.readdirSync(pluginsPath).filter(file => file.endsWith('.js'));
    for (const file of pluginFiles) {
        const command = require(path.join(pluginsPath, file));
        commands.set(command.name, command);
        console.log(`Plugin Imepakiwa: ${command.name}`);
    }

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        
        // Mfumo wa Prefix (kama unataka kutumia . au !)
        const prefix = "."; 
        if (!body.startsWith(prefix)) return;

        const args = body.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();

        // Tafuta command kwenye plugins
        const command = commands.get(cmdName);
        if (command) {
            try {
                await command.execute(sock, from, msg, args);
            } catch (error) {
                console.error(error);
                await sock.sendMessage(from, { text: "Kuna tatizo limetokea kwenye plugin hii!" });
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);
    console.log("NYONI-MD Ipo Tayari!");
}

startBot();
