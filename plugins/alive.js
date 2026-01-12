module.exports = {
    name: "alive",
    description: "Check if the bot is active and online",
    async execute(sock, from, msg) {
        // Define the alive message content
        const aliveMessage = `*NYONI-XMD IS ONLINE* 🚀\n\n` +
            `*System Status:* Operational ✅\n` +
            `*Version:* 1.0.0\n` +
            `*Platform:* Render (Linux)\n` +
            `*Prefix:* [ . ]\n\n` +
            `_Type .menu to see all available features._`;

        await sock.sendMessage(from, {
            text: aliveMessage,
            contextInfo: {
                externalAdReply: {
                    title: "NYONI-XMD STATUS",
                    body: "System is running smoothly",
                    // Replace with your actual GitHub link or image URL
                    thumbnailUrl: "https://github.com/devnyoni.png", 
                    sourceUrl: "https://github.com/devnyoni/vcf",
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });
    }
};
