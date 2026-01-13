

module.exports = [
    "bully", "cuddle", "cry", "hug", "awoo", "kiss", "lick", "pat", 
    "smug", "bonk", "yeet", "blush", "smile", "wave", "highfive", 
    "handhold", "nom", "bite", "glomp", "slap", "kill", "happy", 
    "wink", "poke", "https", "cringe"
].map(name => ({
    name: name,
    category: "REACTIONS",
    execute: async (sock, from, msg, args) => {
        try {
            // Detect the target (mentioned user or replied message)
            const mention = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                            msg.message.extendedTextMessage?.contextInfo?.participant;
            
            const sender = msg.key.participant || from;
            const senderName = sender.split('@')[0];
            const targetName = mention ? `@${mention.split('@')[0]}` : "themselves";

            // Fetch GIF from waifu.pics API
            // Note: 'https' is mapped to 'smile' to ensure it finds a valid reaction
            const apiType = (name === "https") ? "smile" : name;
            const response = await axios.get(`https://api.waifu.pics/sfw/${apiType}`);
            const imageUrl = response.data.url;

            // Custom English captions for specific reactions
            const captions = {
                bully: `*${senderName}* is bullying *${targetName}*! 😈`,
                cuddle: `*${senderName}* is cuddling *${targetName}*... 🥰`,
                cry: `*${senderName}* is crying... 😭`,
                hug: `*${senderName}* gave a warm hug to *${targetName}*! 🤗`,
                kiss: `*${senderName}* kissed *${targetName}*! 💋`,
                slap: `*${senderName}* slapped *${targetName}*! 🖐️`,
                kill: `*${senderName}* just killed *${targetName}*! 💀`,
                bite: `*${senderName}* is biting *${targetName}*! 🦷`,
                yeet: `*${senderName}* yeeted *${targetName}* away! 🚀`,
                bonk: `*${senderName}* bonked *${targetName}* on the head! 🔨`,
                poke: `*${senderName}* is poking *${targetName}*... 👉`,
                highfive: `*${senderName}* gave a high-five to *${targetName}*! ✋`,
                wave: `*${senderName}* is waving at *${targetName}*! 👋`,
                smile: `*${senderName}* is smiling at *${targetName}*! 😊`
            };

            // Default caption if action is not in the list above
            const finalCaption = captions[name] || `*${senderName}* performed *${name}* on *${targetName}*! ✨`;

            // Send as an Auto-playing GIF (Video with gifPlayback)
            await sock.sendMessage(from, { 
                video: { url: imageUrl }, 
                caption: finalCaption,
                gifPlayback: true,
                mentions: mention ? [sender, mention] : [sender]
            }, { quoted: msg });

            // Add a heart reaction to the user's message
            await sock.sendMessage(from, { react: { text: "💖", key: msg.key } });

        } catch (e) {
            console.error(`Error in ${name} command:`, e.message);
            await sock.sendMessage(from, { text: `❌ Could not find a GIF for *${name}* right now.` });
        }
    }
}));
