const axios = require("axios");

module.exports = {
    name: "ai",
    category: "TOOLS",
    desc: "Ask the AI any question",
    async execute(sock, from, msg, args) {
        // 1. Get the question from user input or quoted text
        let query = args.join(" ");
        if (!query && msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            query = quoted.conversation || quoted.extendedTextMessage?.text;
        }

        if (!query) {
            return sock.sendMessage(from, { text: "Usage: .ai [your question]\nExample: .ai how to cook rice?" });
        }

        // Send a "thinking" reaction or message
        await sock.sendMessage(from, { react: { text: "🤖", key: msg.key } });

        try {
            // 2. Fetch response from a free AI API
            // Using a stable endpoint for Nyoni-XMD
            const response = await axios.get(`https://api.simsimi.vn/v2/simsimi?text=${encodeURIComponent(query)}&lc=en`);
            
            // Note: If the above API is busy, you can use: https://widipe.com/prompt/gpt?prompt=${query}
            
            const aiResponse = response.data.message || "I'm sorry, I couldn't process that request.";

            // 3. Send the AI response
            let resultText = `✨ *NYONI-XMD AI ASSISTANT*\n\n`;
            resultText += `${aiResponse}\n\n`;
            resultText += `_Powered by Nyoni-XMD Engine_`;

            await sock.sendMessage(from, { 
                text: resultText,
                contextInfo: {
                    externalAdReply: {
                        title: "ARTIFICIAL INTELLIGENCE",
                        body: "Ask me anything",
                        thumbnailUrl: "https://files.catbox.moe/t4ts87.jpeg",
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: msg });

        } catch (error) {
            console.error("AI Error:", error);
            await sock.sendMessage(from, { text: "❌ AI server is currently overloaded. Please try again in a moment." });
        }
    }
};
