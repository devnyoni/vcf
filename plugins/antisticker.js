module.exports = {
    name: "antisticker",
    category: "GROUP",
    execute: async (sock, from, msg, args) => {
        if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: "❌ Group only!" });
        
        // Initialize global settings if not exists
        if (!global.groupSettings) global.groupSettings = {};
        if (!global.groupSettings[from]) global.groupSettings[from] = { antisticker: false };

        const action = args[0]?.toLowerCase();
        if (action === "on") {
            global.groupSettings[from].antisticker = true;
            await sock.sendMessage(from, { text: "✅ *Anti-Sticker is now ON.* Any sticker sent will be deleted." });
        } else if (action === "off") {
            global.groupSettings[from].antisticker = false;
            await sock.sendMessage(from, { text: "✅ *Anti-Sticker is now OFF.*" });
        } else {
            await sock.sendMessage(from, { text: `Usage: ${global.prefix}antisticker on/off` });
        }
    }
};
