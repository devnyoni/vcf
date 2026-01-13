const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

module.exports = {
    name: "getstatus",
    alias: ["get", "steal", "save"],
    category: "TOOLS",
    description: "Download WhatsApp Status (Image/Video)",
    async execute(sock, from, msg, args) {
        try {
            // 1. Check if the user replied to a status
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            
            if (!quoted) {
                return sock.sendMessage(from, { text: "❌ Please reply to a *Status* with .get to download it." }, { quoted: msg });
            }

            // 2. Identify the media type (Image or Video)
            const mtype = Object.keys(quoted)[0];

            if (!["imageMessage", "videoMessage"].includes(mtype)) {
                return sock.sendMessage(from, {
                    text: "❌ This command only works for Image or Video statuses."
                }, { quoted: msg });
            }

            // React to show the bot is processing
            await sock.sendMessage(from, { react: { text: "📥", key: msg.key } });

            // 3. Download the status media
            const media = quoted[mtype];
            const stream = await downloadContentFromMessage(media, mtype.replace('Message', ''));
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            // 4. Send the media back to the user
            let messageContent = {};
            const caption = media.caption || "✅ *Status Downloaded by Nyoni-XMD*";

            if (mtype === "imageMessage") {
                messageContent = { image: buffer, caption: caption };
            } else if (mtype === "videoMessage") {
                messageContent = { video: buffer, caption: caption };
            }

            await sock.sendMessage(from, messageContent, { quoted: msg });

        } catch (error) {
            console.error("Status Download Error:", error);
            await sock.sendMessage(from, {
                text: "❌ Error: Could not download the status."
            }, { quoted: msg });
        }
    }
};
