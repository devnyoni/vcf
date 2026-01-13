module.exports = {
    name: "add",
    category: "GROUP",
    desc: "Add a user to the group",
    async execute(sock, from, msg, args) {
        if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: "Groups only." });
        const metadata = await sock.groupMetadata(from);
        const isAdmin = metadata.participants.find(p => p.id === (msg.key.participant || from))?.admin;
        if (!isAdmin) return sock.sendMessage(from, { text: "Admin only." });

        if (!args[0]) return sock.sendMessage(from, { text: "Usage: .add 2557xxxxxxxx" });

        const user = args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        try {
            await sock.groupParticipantsUpdate(from, [user], "add");
            await sock.sendMessage(from, { text: "User added." });
        } catch (e) {
            await sock.sendMessage(from, { text: "Failed to add user. Check if number is correct or they left recently." });
        }
    }
};
