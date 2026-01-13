module.exports = {
    name: "pin",
    category: "GROUP",
    desc: "Pin a message in the group",
    async execute(sock, from, msg, args) {
        // 1. Check if it is a group
        if (!from.endsWith('@g.us')) return sock.sendMessage(from, { text: "This command only works in groups." });

        // 2. Check if user replied to a message
        const quoted = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
        if (!quoted) {
            return sock.sendMessage(from, { text: "Please *reply* to the message you want to pin." });
        }

        try {
            // 3. Check Admin Status
            const metadata = await sock.groupMetadata(from);
            const botIsAdmin = metadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
            const userIsAdmin = metadata.participants.find(p => p.id === (msg.key.participant || from))?.admin;

            if (!userIsAdmin) return sock.sendMessage(from, { text: "Admin rights required to pin messages." });
            if (!botIsAdmin) return sock.sendMessage(from, { text: "I need to be an admin to pin messages." });

            // 4. Pin Duration (Default 24 hours)
            // Options are usually 24 hours (86400), 7 days (604800), or 30 days (2592000)
            let duration = 86400; 
            if (args[0] === '7') duration = 604800;
            if (args[0] === '30') duration = 2592000;

            // 5. Execute Pinning
            await sock.sendMessage(from, {
                pin: {
                    remoteJid: from,
                    fromMe: msg.message.extendedTextMessage.contextInfo.participant === sock.user.id.split(':')[0] + '@s.whatsapp.net',
                    id: quoted,
                    participant: msg.message.extendedTextMessage.contextInfo.participant
                },
                type: 1, // 1 = Pin, 2 = Unpin
                time: duration
            });

            await sock.sendMessage(from, { text: `✅ Message pinned for ${args[0] === '7' ? '7 days' : args[0] === '30' ? '30 days' : '24 hours'}.` });

        } catch (error) {
            console.error("Pin Error:", error);
            await sock.sendMessage(from, { text: "❌ Failed to pin the message. Ensure I have the correct permissions." });
        }
    }
};
