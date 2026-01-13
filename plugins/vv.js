const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

module.exports = {
    name: "vv",
    category: "TOOLS",
    desc: "Download/Resend View Once messages",
    async execute(sock, from, msg, args) {
        // 1. Check if the user replied to a message
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (!quoted) {
            return sock.sendMessage(from, { text: "Please reply to a *View Once* message (image/video)." });
        }

        // 2. Identify if it is a View Once message
        const type = Object.keys(quoted)[0];
        const viewOnce = quoted.viewOnceMessageV2?.message || quoted.viewOnceMessage?.message;
        
        if (!viewOnce) {
            return sock.sendMessage(from, { text: "This is not a View Once message." });
        }

        // 3. Get actual content (image or video)
        const mediaType = Object.keys(viewOnce)[0]; // imageMessage or videoMessage
        const media = viewOnce[mediaType];

        try {
            // 4. Download the media
            const stream = await downloadContentFromMessage(media, mediaType === 'imageMessage' ? 'image' : 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // 5. Resend it as a normal message
            const caption = media.caption || "View Once Downloaded by Nyoni-XMD";
            
            if (mediaType === 'imageMessage') {
                await sock.sendMessage(from, { image: buffer, caption: caption }, { quoted: msg });
            } else if (mediaType === 'videoMessage') {
                await sock.sendMessage(from, { video: buffer, caption: caption }, { quoted: msg });
            }

        } catch (error) {
            console.error(error);
            await sock.sendMessage(from, { text: "❌ Failed to download View Once media." });
        }
    }
};
