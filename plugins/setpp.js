        // --- PROFILE PICTURE SETTER (.setpp) ---
        if (isOwner && body === '.setpp') {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (quoted?.imageMessage) {
                const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await(const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                
                await sock.updateProfilePicture(sock.user.id, buffer); 
                return sock.sendMessage(from, { text: "✅ *Profile picture updated successfully!*" });
            } else {
                return sock.sendMessage(from, { text: "❌ *Please reply to an image with .setpp to update the bot's profile picture.*" });
            }
        }
