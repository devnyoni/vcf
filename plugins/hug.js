const axios = require("axios");

module.exports = {
    name: "hug",
    category: "REACTIONS",
    desc: "Send a hug reaction",
    async execute(sock, from, msg, args) {
        try {
            const res = await axios.get("https://api.waifu.pics/sfw/hug");
            const user = msg.key.participant || from;
            const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || "someone";
            
            await sock.sendMessage(from, { 
                video: { url: res.data.url }, 
                caption: `*@${user.split('@')[0]} hugs ${mentioned.includes('@') ? '@' + mentioned.split('@')[0] : mentioned}* 🤗`,
                gifPlayback: true,
                mentions: [user, mentioned].filter(v => v.includes('@'))
            }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(from, { text: "Failed to fetch reaction." });
        }
    }
};
