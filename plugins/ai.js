const axios = require("axios");

module.exports = {
    name: "ai",
    category: "AI",
    execute: async (sock, from, msg, args) => {
        const text = args.join(" ");
        
        // Check if the user provided a question
        if (!text) {
            return await sock.sendMessage(from, { 
                text: `*Hello! I am Nyoni-XMD AI.* 🤖\n\n*Usage:* ${global.prefix}ai What is the capital of Tanzania?` 
            }, { quoted: msg });
        }

        // Add a reaction to show the AI is thinking
        await sock.sendMessage(from, { react: { text: "🧠", key: msg.key } });

        try {
            // Using a reliable free AI API (Llama/GPT-3 logic)
            const response = await axios.get(`https://api.giftedtech.my.id/api/ai/gpt4?apikey=gifted&q=${encodeURIComponent(text)}`);
            
            const aiResult = response.data.result;

            const aiResponse = `*╭┈〔 🤖 NYONI-AI 〕┈─*
┃
${aiResult}
┃
╰──────────┈`;

            await sock.sendMessage(from, { text: aiResponse }, { quoted: msg });
            
            // Final reaction
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (e) {
            console.error("AI Command Error:", e);
            await sock.sendMessage(from, { 
                text: "❌ *AI Server is busy. Please try again later.*" 
            }, { quoted: msg });
        }
    }
};
