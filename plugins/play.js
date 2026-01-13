const yts = require("yt-search");

module.exports = {
    name: "play",
    category: "DOWNLOADER",
    desc: "Download and play music from YouTube",
    async execute(sock, from, msg, args) {
        const query = args.join(" ");
        if (!query) return sock.sendMessage(from, { text: "Please provide a song name.\nExample: .play Calm Down" });

        await sock.sendMessage(from, { react: { text: "📥", key: msg.key } });

        try {
            // 1. Search for the video on YouTube
            const search = await yts(query);
            const video = search.videos[0];

            if (!video) return sock.sendMessage(from, { text: "Song not found. Try a different title." });

            const playMsg = `🎵 *NYONI-XMD MUSIC PLAYER* 🎵\n\n` +
                            `📌 *Title:* ${video.title}\n` +
                            `👤 *Channel:* ${video.author.name}\n` +
                            `⌚ *Duration:* ${video.timestamp}\n` +
                            `🔗 *Link:* ${video.url}\n\n` +
                            `_Please wait, downloading your audio..._`;

            // 2. Send details first with thumbnail
            await sock.sendMessage(from, { 
                image: { url: video.thumbnail }, 
                caption: playMsg 
            }, { quoted: msg });

            // 3. Download and send the audio
            // Note: For a 100% working downloader, we use a public API to convert YT to MP3
            const apiUrl = `https://api.dhammasepun.me/api/ytmp3?url=${video.url}`;
            
            await sock.sendMessage(from, { 
                audio: { url: apiUrl }, 
                mimetype: "audio/mp4", 
                fileName: `${video.title}.mp3` 
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (error) {
            console.error("Play Error:", error);
            await sock.sendMessage(from, { text: "❌ Connection error. Please try again later." });
        }
    }
};
                                   
