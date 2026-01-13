const axios = require("axios");

module.exports = {
    name: "clap",
    category: "REACTIONS",
    desc: "Applaud or clap for someone",
    async execute(sock, from, msg, args) {
        try {
            // Using a reliable anime GIF API
            const res = await axios.get("https://api.waifu.pics/sfw/smile"); // Alternative if specific 'clap' is missing
            
            const sender = msg.key.participant || from;
            let target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                         msg.message.extendedTextMessage?.contextInfo?.participant;

            const caption = target 
                ? `*@${sender.split('@')[0]} claps for @${target.split('@')[0]}!* 👏✨` 
                : `*Clap Clap Clap!* 👏👏👏`;

            await sock.sendMessage(from, { 
                video: { url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueXZ0bmZ3bmZ3bmZ3/3o72FcJdfXJt7XgKDG/giphy.gif" }, 
                caption: caption,
                gifPlayback: true,
                mentions: target ? [sender, target] : [sender]
            }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(from, { text: "Error: API is currently down." });
        }
    }
};
