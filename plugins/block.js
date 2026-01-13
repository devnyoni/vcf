module.exports = {
    name: "block",
    category: "OWNER",
    desc: "Block a user from using the bot",
    async execute(sock, from, msg, args) {
        // 1. Security Check: Only the owner can block
        const sender = msg.key.participant || from;
        const botOwner = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const isOwner = msg.key.fromMe || sender.split('@')[0] === sock.user.id.split(':')[0];

        if (!isOwner) {
            return sock.sendMessage(from, { text: "❌ This command is restricted to the Bot Owner only." });
        }

        // 2. Identify the target to block
        let target;
        if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        } else if (args[0]) {
            target = args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net";
        }

        if (!target) {
            return sock.sendMessage(from, { text: "⚠️ Please tag a user or reply to their message to block them." });
        }

        // 3. Prevent blocking yourself (the owner)
        if (target === botOwner) {
            return sock.sendMessage(from, { text: "🚫 You cannot block yourself!" });
        }

        try {
            // 4. Execute Block
            await sock.updateBlockStatus(target, "block");
            
            await sock.sendMessage(from, { 
                text: `✅ Successfully blocked @${target.split('@')[0]}. They can no longer message this bot.`,
                mentions: [target]
            }, { quoted: msg });

        } catch (error) {
            console.error("Block Error:", error);
            await sock.sendMessage(from, { text: "❌ Failed to block the user. Please try again." });
        }
    }
};
