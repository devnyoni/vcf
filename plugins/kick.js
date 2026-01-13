module.exports = {
    name: "kick",
    category: "GROUP",
    desc: "Remove a member from the group",
    async execute(sock, from, msg, args) {
        if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: "This command is only for groups." });
        const metadata = await sock.groupMetadata(from);
        const isAdmin = metadata.participants.find(p => p.id === (msg.key.participant || from))?.admin;
        const botIsAdmin = metadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;

        if (!isAdmin) return sock.sendMessage(from, { text: "Admin rights required." });
        if (!botIsAdmin) return sock.sendMessage(from, { text: "I need to be an admin to perform this." });

        let users = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            users.push(msg.message.extendedTextMessage.contextInfo.participant);
        }

        if (users.length === 0) return sock.sendMessage(from, { text: "Tag or reply to a user to kick." });

        for (let user of users) {
            await sock.groupParticipantsUpdate(from, [user], "remove");
        }
        await sock.sendMessage(from, { text: "Target removed successfully." });
    }
};
