module.exports = {
    name: "tagall",
    async execute(sock, from, msg, args) {
        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;
        let message = args.join(" ") || "Attention Everyone!";
        message += "\n\n";
        
        const mentions = [];
        for (let participant of participants) {
            message += `@${participant.id.split('@')[0]} `;
            mentions.push(participant.id);
        }
        
        await sock.sendMessage(from, { text: message, mentions });
    }
};
