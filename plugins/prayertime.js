const axios = require("axios");

module.exports = {
    name: "prayer",
    category: "TOOLS",
    desc: "Get Islamic prayer times for a specific city",
    async execute(sock, from, msg, args) {
        // Default city is Dar es Salaam if no city is provided
        const city = args.join(" ") || "Dar es Salaam";
        const country = "Tanzania"; 

        try {
            const response = await axios.get(`https://api.aladhan.com/v1/timingsByCity?city=${city}&country=${country}&method=3`);
            
            if (response.data.code !== 200) {
                return sock.sendMessage(from, { text: "❌ City not found. Please check the spelling." });
            }

            const timings = response.data.data.timings;
            const date = response.data.data.date;

            let prayerMsg = `🕌 *PRAYER TIMES: ${city.toUpperCase()}*\n`;
            prayerMsg += `*Date:* ${date.readable}\n`;
            prayerMsg += `*Hijri:* ${date.hijri.day} ${date.hijri.month.en} ${date.hijri.year}\n\n`;
            
            prayerMsg += `✨ *Fajr:* ${timings.Fajr}\n`;
            prayerMsg += `☀️ *Sunrise:* ${timings.Sunrise}\n`;
            prayerMsg += `🌤️ *Dhuhr:* ${timings.Dhuhr}\n`;
            prayerMsg += `🌥️ *Asr:* ${timings.Asr}\n`;
            prayerMsg += `🌅 *Maghrib:* ${timings.Maghrib}\n`;
            prayerMsg += `🌙 *Isha:* ${timings.Isha}\n\n`;
            
            prayerMsg += `_Source: Aladhan API_`;

            await sock.sendMessage(from, { 
                text: prayerMsg,
                contextInfo: {
                    externalAdReply: {
                        title: "NYONI-XMD RELIGIOUS TOOLS",
                        body: `Timings for ${city}`,
                        thumbnailUrl: "https://files.catbox.moe/t4ts87.jpeg",
                        mediaType: 1,
                        renderLargerThumbnail: false
                    }
                }
            }, { quoted: msg });

        } catch (error) {
            console.error("Prayer Error:", error);
            await sock.sendMessage(from, { text: "❌ Connection error. Could not fetch prayer times." });
        }
    }
};
              
