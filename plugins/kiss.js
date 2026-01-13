const axios = require("axios");

module.exports = {
    name: "kiss",
    category: "REACTIONS",
    desc: "Send a kiss reaction to someone",
    async execute(sock, from, msg, args) {
        try {
            // Fetching a random kiss GIF from the API
            const response = await axios.get("https://api.waifu.pics/sfw/kiss");
            const gifUrl = response.data.url;

            // Identification of sender and target
            const sender = msg.key.participant || from;
            let target;

            // Check if a user is mentioned or if it's a reply
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
                target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            } else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
                target = msg.message.extendedTextMessage.contextInfo.participant;
            }

            // Create caption based on target
            const senderName = `@${sender.split('@')[0]}`;
            const targetName = target ? `@${target.split('@')[0]}` : "themselves (so lonely!)";
            const caption = `*${senderName}* gives a sweet kiss to *${targetName}* 💋`;

            // Send as GIF playback
            await sock.sendMessage(from, { 
                video: { url: gifUrl }, 
                caption: caption,
                gifPlayback: true,
                mentions: target ? [sender, target] : [sender]
            }, { quoted: msg });

        } catch (error) {
            console.error("Error in kiss command:", error);
            await sock.sendMessage(from, { text: "❌ Failed to fetch the kiss reaction. Please try again later." });
        }
    }
};
