module.exports = {
    name: "kick",
    description: "Remove a user from the group",
    async execute(sock, from, msg, args) {
        if (!msg.key.remoteJid.endsWith('@g.us')) return sock.sendMessage(from, { text: "This command only works in groups!" });
        
        const user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0] || (args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null);
        
        if (!user) return sock.sendMessage(from, { text: "Please mention or provide the number of the user to kick." });
        
        await sock.groupParticipantsUpdate(from, [user], "remove");
        await sock.sendMessage(from, { text: "User has been removed. 🚪" });
    }
};
