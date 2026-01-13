const axios = require("axios");

module.exports = {
    name: "fb",
    alias: ["facebook", "fbdl"],
    category: "DOWNLOADER",
    desc: "Download Facebook videos",
    async execute(sock, from, msg, args) {
        const url = args.join(" ");
        if (!url) return sock.sendMessage(from, { text: "Please provide a Facebook video link.\nExample: .fb https://www.facebook.com/watch/?v=xxxxx" });

        // Show loading reaction
        await sock.sendMessage(from, { react: { text: "📽️", key: msg.key } });

        try {
            // Using a free API to fetch Facebook video data
            const res = await axios.get(`https://api.vreden.my.id/api/fbdl?url=${encodeURIComponent(url)}`);
            
            if (!res.data || !res.data.result) {
                return sock.sendMessage(from, { text: "❌ Video not found. Ensure the link is public." });
            }

            const videoData = res.data.result;
            // Prioritize HD quality if available, otherwise use SD
            const downloadUrl = videoData.hd || videoData.sd;

            const caption = `🔵 *NYONI-XMD FACEBOOK DL* 🔵\n\n` +
                            `🎬 *Title:* ${videoData.title || "Facebook Video"}\n` +
                            `✨ *Quality:* ${videoData.hd ? 'HD' : 'SD'}\n\n` +
                            `_Processing complete!_`;

            // Send the Video file
            await sock.sendMessage(from, { 
                video: { url: downloadUrl }, 
                caption: caption 
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (error) {
            console.error("FB Download Error:", error);
            await sock.sendMessage(from, { text: "❌ Error: The server is busy or the link is invalid." });
        }
    }
};
      
