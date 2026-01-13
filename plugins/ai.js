const axios = require("axios");

module.exports = {
    name: "ai",
    alias: ["gpt", "ask", "nyoni"],
    category: "AI",
    description: "Ask Nyoni AI anything",
    async execute(sock, from, msg, args) {
        const text = args.join(" ");
        if (!text) return sock.sendMessage(from, { text: "💡 Please provide a question!\nExample: .ai how to cook pilau?" });

        await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

        try {
            // Using a free AI API (e.g., Guru API or similar reliable source)
            const response = await axios.get(`https://api.giftedtech.my.id/api/ai/gpt4?apikey=gifted&q=${encodeURIComponent(text)}`);
            
            const result = response.data.result;

            if (result) {
                await sock.sendMessage(from, { 
                    text: `🤖 *NYONI-AI RESPONSE:*\n\n${result}\n\n_Powered by Nyoni-XMD_` 
                }, { quoted: msg });
            } else {
                throw new Error("No response from AI");
            }

        } catch (error) {
            console.error("AI Error:", error);
            await sock.sendMessage(from, { text: "❌ AI is currently unavailable. Please try again later." });
        }
    }
};
