module.exports = {
    name: "group",
    category: "GROUP",
    desc: "Open or Close group chat",
    async execute(sock, from, msg, args) {
        const metadata = await sock.groupMetadata(from);
        const isAdmin = metadata.participants.find(p => p.id === (msg.key.participant || from))?.admin;
        if (!isAdmin) return sock.sendMessage(from, { text: "Admin only." });

        if (args[0] === 'open') {
            await sock.groupSettingUpdate(from, 'not_announcement');
            await sock.sendMessage(from, { text: "Group is now open for everyone." });
        } else if (args[0] === 'close') {
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: "Group is now closed (Admins only)." });
        } else {
            await sock.sendMessage(from, { text: "Use: .group open OR .group close" });
        }
    }
};
