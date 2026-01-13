const axios = require("axios"); // Lazima ianze hapa ili kuvuta picha mtandaoni

module.exports = [
    "bully", "cuddle", "cry", "hug", "awoo", "kiss", "lick", "pat", 
    "smug", "bonk", "yeet", "blush", "smile", "wave", "highfive", 
    "handhold", "nom", "bite", "glomp", "slap", "kill", "happy", 
    "wink", "poke", "cringe"
].map(name => ({
    name: name,
    category: "REACTIONS",
    execute: async (sock, from, msg) => {
        try {
            // Kupata namba ya aliyetagiwa au kurepiliwa
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                            msg.message.extendedTextMessage?.contextInfo?.participant;
            
            const sender = msg.key.participant || from;
            const senderName = sender.split('@')[0];
            const targetName = mention ? `@${mention.split('@')[0]}` : "themselves";

            // Kuchukua GIF kutoka waifu.pics API
            const response = await axios.get(`https://api.waifu.pics/sfw/${name}`);
            const imageUrl = response.data.url;

            // Ujumbe mfupi wa kitendo
            let emoji = "✨";
            if (name === "slap") emoji = "🖐️";
            if (name === "kiss") emoji = "💋";
            if (name === "hug") emoji = "🤗";
            if (name === "kill") emoji = "💀";

            const caption = `*${senderName}* performed *${name}* on *${targetName}* ${emoji}`;

            // Kutuma kama GIF (Video inayocheza yenyewe)
            await sock.sendMessage(from, { 
                video: { url: imageUrl }, 
                caption: caption,
                gifPlayback: true,
                mentions: mention ? [sender, mention] : [sender]
            }, { quoted: msg });

        } catch (e) {
            console.error(`Error in ${name} command:`, e.message);
        }
    }
}));
