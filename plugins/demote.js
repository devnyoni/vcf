module.exports = {
    name: "demote",
    category: "GROUP",
    desc: "Remove admin status",
    async execute(sock, from, msg, args) {
        const metadata = await sock.groupMetadata(from);
        const isAdmin = metadata.participants.find(p => p.id === (msg.key.participant || from))?.admin;
        if (!isAdmin) return sock.sendMessage(from, { text: "Admin only." });

        let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (users.length === 0) return sock.sendMessage(from, { text: "Mention an admin to demote." });

        await sock.groupParticipantsUpdate(from, users, "demote");
        await sock.sendMessage(from, { text: "Admin status revoked." });
    }
};
