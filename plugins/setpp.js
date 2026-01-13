const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

module.exports = {
    name: "setpp",
    description: "Update bot profile picture",
    async execute(sock, from, msg, args) {
        // Only the owner can change the PP
        if (!msg.key.fromMe) return; 

        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        
        if (quoted && quoted.imageMessage) {
            try {
                const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                await sock.updateProfilePicture(sock.user.id, buffer);
                return sock.sendMessage(from, { text: "✅ *Profile picture updated successfully!*" });
            } catch (e) {
                console.log(e);
                return sock.sendMessage(from, { text: "❌ *Error updating profile picture.*" });
            }
        } else {
            return sock.sendMessage(from, { text: "❌ *Please reply to an image with .setpp*" });
        }
    }
};
