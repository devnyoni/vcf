const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");
const pino = require("pino");

const commands = new Map();
const prefix = ","; 

async function startNyoni() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Nyoni-XMD", "Chrome", "20.0.04"]
    });

    // Kusoma Plugins
    const pluginsPath = path.join(__dirname, 'plugins');
    if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath);

    fs.readdirSync(pluginsPath).forEach(file => {
        if (file.endsWith(".js")) {
            try {
                const plugin = require(path.join(pluginsPath, file));
                commands.set(plugin.name, plugin);
                console.log(`Successfully loaded: ${plugin.name}`);
            } catch (e) {
                console.error(`Failed to load plugin ${file}:`, e);
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");

        if (!body.startsWith(prefix)) return;
        const args = body.slice(prefix.length).trim().split(/ +/);
        const cmdName = args.shift().toLowerCase();

        const plugin = commands.get(cmdName);
        if (plugin) {
            try {
                await plugin.execute(sock, from, msg, args, commands);
            } catch (err) {
                console.error(err);
                await sock.sendMessage(from, { text: "⚠️ Error executing command!" });
            }
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) startNyoni();
        } else if (connection === 'open') {
            console.log('NYONI-XMD IS LIVE! 🚀');
            // Tuma ujumbe kwenye newsletter bot ikishawaka
            await sock.sendMessage("120363399470975987@newsletter", { text: "NYONI-XMD IS RUNNING SUCCESSFULLY! 🚀" });
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

startNyoni();
