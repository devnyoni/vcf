module.exports = [
    {
        name: "kick",
        category: "GROUP",
        execute: async (sock, from, msg, args) => {
            const metadata = await sock.groupMetadata(from);
            const isBotAdmin = metadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
            const isAdmin = metadata.participants.find(p => p.id === msg.key.participant)?.admin;

            if (!isAdmin) return sock.sendMessage(from, { text: "❌ *Admin only command!*" });
            if (!isBotAdmin) return sock.sendMessage(from, { text: "❌ *I need to be an Admin first!*" });

            let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!user && args[0]) user = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

            if (!user) return sock.sendMessage(from, { text: "❌ *Tag or reply to the user you want to kick!*" });
            
            await sock.groupParticipantsUpdate(from, [user], "remove");
            await sock.sendMessage(from, { text: "✅ *User has been removed.*" });
        }
    },
    {
        name: "add",
        category: "GROUP",
        execute: async (sock, from, msg, args) => {
            const metadata = await sock.groupMetadata(from);
            const isBotAdmin = metadata.participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
            if (!isBotAdmin) return sock.sendMessage(from, { text: "❌ *Bot must be admin to add users!*" });

            let user = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (!args[0]) return sock.sendMessage(from, { text: "❌ *Provide a number!* Example: .add 255760xxxxxx" });

            await sock.groupParticipantsUpdate(from, [user], "add");
            await sock.sendMessage(from, { text: "✅ *User added.*" });
        }
    },
    {
        name: "promote",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!user) return sock.sendMessage(from, { text: "❌ *Reply to or tag someone to promote!*" });
            await sock.groupParticipantsUpdate(from, [user], "promote");
            await sock.sendMessage(from, { text: "✅ *Admin rights granted.*" });
        }
    },
    {
        name: "demote",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!user) return sock.sendMessage(from, { text: "❌ *Reply to or tag someone to demote!*" });
            await sock.groupParticipantsUpdate(from, [user], "demote");
            await sock.sendMessage(from, { text: "✅ *Admin rights removed.*" });
        }
    },
    {
        name: "mute",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: "🔒 *Group Closed.* Only Admins can message now." });
        }
    },
    {
        name: "unmute",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            await sock.groupSettingUpdate(from, 'not_announcement');
            await sock.sendMessage(from, { text: "🔓 *Group Opened.* Everyone can message now." });
        }
    },
    {
        name: "tagall",
        category: "GROUP",
        execute: async (sock, from, msg, args) => {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            const message = args.join(" ") || "No Message Provided";
            
            let tag = `*╭┈〔 📢 TAG ALL 〕┈─*\n┃\n┃ ✧ *Message:* ${message}\n┃\n`;
            participants.forEach(mem => {
                tag += `┃ ✧ @${mem.id.split('@')[0]}\n`;
            });
            tag += `┃\n╰──────────┈`;

            await sock.sendMessage(from, { text: tag, mentions: participants.map(a => a.id) });
        }
    },
    {
        name: "hidetag",
        category: "GROUP",
        execute: async (sock, from, msg, args) => {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            const message = args.join(" ");
            if (!message) return sock.sendMessage(from, { text: "❌ *Enter a message to hidetag!*" });

            await sock.sendMessage(from, { text: message, mentions: participants.map(a => a.id) });
        }
    },
    {
        name: "link",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            const code = await sock.groupInviteCode(from);
            await sock.sendMessage(from, { text: `https://chat.whatsapp.com/${code}` }, { quoted: msg });
        }
    },
    {
        name: "resetlink",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            await sock.groupRevokeInvite(from);
            await sock.sendMessage(from, { text: "✅ *Group link has been reset successfully.*" });
        }
    }
];
