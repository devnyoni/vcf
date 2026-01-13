module.exports = {
    name: "revoke",
    category: "GROUP",
    desc: "Reset group invite link",
    async execute(sock, from, msg, args) {
        const metadata = await sock.groupMetadata(from);
        const isAdmin = metadata.participants.find(p => p.id === (msg.key.participant || from))?.admin;
        if (!isAdmin) return sock.sendMessage(from, { text: "Admin only." });

        await sock.groupRevokeInvite(from);
        await sock.sendMessage(from, { text: "Group link has been reset." });
    }
};
