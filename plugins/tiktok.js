const axios = require("axios");

module.exports = {
    name: "tiktok",
    alias: ["tt", "ttdl"],
    category: "DOWNLOADER",
    desc: "Download TikTok videos without watermark",
    async execute(sock, from, msg, args) {
        const text = args.join(" ");
        if (!text) return sock.sendMessage(from, { text: "Please provide a TikTok link.\nExample: .tiktok https://vm.tiktok.com/xxx/" });

        // Show loading reaction
        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        try {
            // Using a reliable TikTok API
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(text)}`);
            
            if (!res.data || !res.data.video) {
                return sock.sendMessage(from, { text: "❌ Failed to fetch video. Make sure the link is valid and public." });
            }

            const data = res.data;
            const videoUrl = data.video.noWatermark || data.video.watermark;
            
            const caption = `🎬 *NYONI-XMD TIKTOK DL* 🎬\n\n` +
                            `👤 *Author:* ${data.author.nickname || "Unknown"}\n` +
                            `📝 *Description:* ${data.title || "No description"}\n\n` +
                            `_Successfully downloaded without watermark!_`;

            // Send the Video
            await sock.sendMessage(from, { 
                video: { url: videoUrl }, 
                caption: caption 
            }, { quoted: msg });

            // Remove loading reaction
            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (error) {
            console.error("TikTok Error:", error);
            await sock.sendMessage(from, { text: "❌ Error: Could not connect to the downloader server." });
        }
    }
};
