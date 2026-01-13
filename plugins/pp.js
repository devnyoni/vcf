module.exports = {
    name: "pp",
    category: "TOOLS",
    desc: "Get or download someone's profile picture",
    async execute(sock, from, msg, args) {
        try {
            // 1. Identify the target user
            let target;
            if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
                target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
            } else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
                target = msg.message.extendedTextMessage.contextInfo.participant;
            } else if (args[0]) {
                target = args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
            } else {
                target = msg.key.participant || from; // Get your own PP if no one is tagged
            }

            // 2. Fetch the Profile Picture URL
            let ppUrl;
            try {
                ppUrl = await sock.profilePictureUrl(target, 'image');
            } catch (e) {
                // If the user has no PP or privacy settings block it
                return sock.sendMessage(from, { text: "❌ Failed to retrieve profile picture. It might be hidden or empty." });
            }

            // 3. Send the image back to the chat
            const caption = `*Profile Picture retrieved by Nyoni-XMD* 📸\nUser: @${target.split('@')[0]}`;
            
            await sock.sendMessage(from, { 
                image: { url: ppUrl }, 
                caption: caption,
                mentions: [target]
            }, { quoted: msg });

        } catch (error) {
            console.error("PP Command Error:", error);
            await sock.sendMessage(from, { text: "❌ An error occurred while fetching the profile picture." });
        }
    }
};
