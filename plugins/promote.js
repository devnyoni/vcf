
module.exports = {
    name: "promote",
    async execute(sock, from, msg) {
        const user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid[0];
        if (!user) return sock.sendMessage(from, { text: "Mention the user to promote." });
        await sock.groupParticipantsUpdate(from, [user], "promote");
        await sock.sendMessage(from, { text: "User is now an Admin! 👑" });
    }
};
