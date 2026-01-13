module.exports = {
    name: "tagall",
    category: "GROUP",
    desc: "Tag all participants",
    async execute(sock, from, msg, args) {
        const metadata = await sock.groupMetadata(from);
        const isAdmin = metadata.participants.find(p => p.id === (msg.key.participant || from))?.admin;
        if (!isAdmin) return sock.sendMessage(from, { text: "Admin only." });

        let message = args.join(" ") || "Attention everyone!";
        let participants = metadata.participants.map(v => v.id);
        
        let text = `📢 *Attention Everyone*\n\n*Message:* ${message}\n\n`;
        for (let mem of participants) {
            text += `🔹 @${mem.split('@')[0]}\n`;
        }

        await sock.sendMessage(from, { text: text, mentions: participants });
    }
};
