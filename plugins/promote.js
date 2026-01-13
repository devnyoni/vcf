module.exports = {
    name: "promote",
    category: "GROUP",
    desc: "Make someone an admin",
    async execute(sock, from, msg, args) {
        const metadata = await sock.groupMetadata(from);
        const isAdmin = metadata.participants.find(p => p.id === (msg.key.participant || from))?.admin;
        if (!isAdmin) return sock.sendMessage(from, { text: "Admin only." });

        let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (users.length === 0) return sock.sendMessage(from, { text: "Mention a user to promote." });

        await sock.groupParticipantsUpdate(from, users, "promote");
        await sock.sendMessage(from, { text: "New admin(s) assigned." });
    }
};
