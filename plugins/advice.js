const axios = require("axios");

module.exports = {
    name: "advice",
    category: "INTERACTION",
    desc: "Get a random life advice",
    async execute(sock, from, msg, args) {
        try {
            // Fetching random advice from the API
            const res = await axios.get("https://api.adviceslip.com/advice");
            const advice = res.data.slip.advice;

            let adviceMsg = `💡 *NYONI-XMD LIFE ADVICE*\n\n`;
            adviceMsg += `"${advice}"\n\n`;
            adviceMsg += `_Keep moving forward._`;

            await sock.sendMessage(from, { 
                text: adviceMsg,
                contextInfo: {
                    externalAdReply: {
                        title: "DAILY ADVICE",
                        body: "Wisdom for today",
                        thumbnailUrl: "https://files.catbox.moe/t4ts87.jpeg",
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: msg });

        } catch (error) {
            console.error("Advice Error:", error);
            await sock.sendMessage(from, { text: "❌ Failed to fetch advice. Stay wise anyway!" });
        }
    }
};
