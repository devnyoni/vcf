module.exports = {
    name: "setprefix",
    category: "OWNER",
    execute: async (sock, from, msg, args) => {
        const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
        if (!isOwner) return;
        if (!args[0]) return sock.sendMessage(from, { text: "Usage: .setprefix !" });

        global.prefix = args[0];
        await sock.sendMessage(from, { text: `✅ Prefix changed to: *${global.prefix}*` }, { quoted: msg });
    }
};
