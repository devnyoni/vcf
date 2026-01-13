const axios = require("axios");

module.exports = {
    name: "kill",
    category: "REACTIONS",
    desc: "Kill or attack someone",
    async execute(sock, from, msg, args) {
        try {
            // Using waifu.pics for the kill/slap animation
            const res = await axios.get("https://api.waifu.pics/sfw/kill").catch(() => 
                axios.get("https://api.waifu.pics/sfw/slap")
            );
            
            const sender = msg.key.participant || from;
            let target = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                         msg.message.extendedTextMessage?.contextInfo?.participant;

            const caption = target 
                ? `*@${sender.split('@')[0]} killed @${target.split('@')[0]}!* 💀🔥` 
                : `*@${sender.split('@')[0]} is looking for someone to kill...* 🔪`;

            await sock.sendMessage(from, { 
                video: { url: res.data.url }, 
                caption: caption,
                gifPlayback: true,
                mentions: target ? [sender, target] : [sender]
            }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(from, { text: "Error: Could not perform action." });
        }
    }
};
