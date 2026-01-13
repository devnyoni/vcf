const axios = require("axios");

module.exports = {
    name: "livescore",
    alias: ["score", "live"],
    category: "TOOLS",
    desc: "Get real-time football scores",
    async execute(sock, from, msg, args) {
        // Show loading reaction
        await sock.sendMessage(from, { react: { text: "⚽", key: msg.key } });

        try {
            // Using a public football API endpoint (Example: free-api-live-football-data)
            const res = await axios.get("https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard");
            
            const events = res.data.events;
            if (!events || events.length === 0) {
                return sock.sendMessage(from, { text: "🏁 No live matches found at the moment." });
            }

            let scoreMsg = `🏆 *NYONI-XMD LIVE SCORES* 🏆\n\n`;

            // Limit to top 10 matches to avoid a massive text block
            const topMatches = events.slice(0, 10);

            topMatches.forEach((match) => {
                const homeTeam = match.competitions[0].competitors[0].team.displayName;
                const awayTeam = match.competitions[0].competitors[1].team.displayName;
                const homeScore = match.competitions[0].competitors[0].score;
                const awayScore = match.competitions[0].competitors[1].score;
                const status = match.status.type.detail;
                const league = match.season.displayName || "International";

                scoreMsg += `📌 *${league}*\n`;
                scoreMsg += `🏟️ ${homeTeam}  ${homeScore} - ${awayScore}  ${awayTeam}\n`;
                scoreMsg += `🕒 *Status:* ${status}\n`;
                scoreMsg += `⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯\n`;
            });

            scoreMsg += `\n_Updated just now via ESPN API_`;

            await sock.sendMessage(from, { 
                text: scoreMsg,
                contextInfo: {
                    externalAdReply: {
                        title: "FOOTBALL UPDATES",
                        body: "Live Match Statistics",
                        thumbnailUrl: "https://files.catbox.moe/t4ts87.jpeg",
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: msg });

        } catch (error) {
            console.error("Livescore Error:", error);
            await sock.sendMessage(from, { text: "❌ Failed to fetch live scores. Please try again later." });
        }
    }
};
