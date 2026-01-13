module.exports = {
    name: "antisticker",
    category: "ADMIN",
    description: "Enable or disable sticker deletion",
    async execute(sock, from, msg, args) {
        const sender = msg.key.participant || from;
        const groupMetadata = from.endsWith('@g.us') ? await sock.groupMetadata(from) : null;
        
        if (!groupMetadata) return sock.sendMessage(from, { text: "❌ This is a Group-only command." });
        
        const isAdmin = groupMetadata.participants.find(v => v.id === sender)?.admin !== null;
        if (!isAdmin) return sock.sendMessage(from, { text: "❌ Admin only!" });

        if (args[0] === "on") {
            global.botSettings.antiSticker = true;
            await sock.sendMessage(from, { text: "✅ *Anti-Sticker is now ON.* I will delete all new stickers." });
        } else if (args[0] === "off") {
            global.botSettings.antiSticker = false;
            await sock.sendMessage(from, { text: "❌ *Anti-Sticker is now OFF.*" });
        } else {
            await sock.sendMessage(from, { text: "Usage: .antisticker on/off" });
        }
    }
};
