module.exports = {
    name: "add",
    description: "Add a user to the group",
    async execute(sock, from, msg, args) {
        if (!msg.key.remoteJid.endsWith('@g.us')) return;
        
        const user = args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null;
        if (!user) return sock.sendMessage(from, { text: "Please provide the number (e.g., .add 255610209120)" });
        
        await sock.groupParticipantsUpdate(from, [user], "add");
        await sock.sendMessage(from, { text: "User added successfully! ✅" });
    }
};
