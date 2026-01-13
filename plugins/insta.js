const axios = require("axios");

module.exports = {
    name: "ig",
    alias: ["instagram", "igdl"],
    category: "DOWNLOADER",
    desc: "Download Instagram Reels, Videos or Photos",
    async execute(sock, from, msg, args) {
        const url = args.join(" ");
        if (!url) return sock.sendMessage(from, { text: "Please provide an Instagram link.\nExample: .ig https://www.instagram.com/reels/xxx/" });

        // Show loading reaction
        await sock.sendMessage(from, { react: { text: "📸", key: msg.key } });

        try {
            // Using a stable Instagram Downloader API
            const res = await axios.get(`https://api.vreden.my.id/api/igdl?url=${encodeURIComponent(url)}`);
            
            if (!res.data || !res.data.result || res.data.result.length === 0) {
                return sock.sendMessage(from, { text: "❌ Media not found. Is the account private?" });
            }

            const mediaArray = res.data.result;
            const caption = `📸 *NYONI-XMD INSTAGRAM DL* 📸\n\n_Successfully fetched your media!_`;

            // Loop through results (in case it's a carousel/multiple slides)
            for (let i = 0; i < mediaArray.length; i++) {
                const mediaUrl = mediaArray[i].url;
                const isVideo = mediaUrl.includes(".mp4");

                if (isVideo) {
                    await sock.sendMessage(from, { video: { url: mediaUrl }, caption: i === 0 ? caption : "" }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { image: { url: mediaUrl }, caption: i === 0 ? caption : "" }, { quoted: msg });
                }
            }

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (error) {
            console.error("IG Download Error:", error);
            await sock.sendMessage(from, { text: "❌ Error: Could not fetch media. The API might be down or the link is private." });
        }
    }
};
