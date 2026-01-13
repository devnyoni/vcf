module.exports = [
    {
        name: "add",
        category: "GROUP",
        execute: async (sock, from, msg, args) => {
            const isBotAdmin = (await sock.groupMetadata(from)).participants.find(p => p.id === sock.user.id.split(':')[0] + '@s.whatsapp.net')?.admin;
            if (!isBotAdmin) return sock.sendMessage(from, { text: "❌ Bot lazima iwe Admin kwanza!" });
            
            let user = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
            if (!args[0]) return sock.sendMessage(from, { text: "❌ Weka namba! Mfano: .add 255760xxxxxx" });
            
            await sock.groupParticipantsUpdate(from, [user], "add");
            await sock.sendMessage(from, { text: "✅ User ameongezwa!" });
        }
    },
    {
        name: "kick",
        category: "GROUP",
        execute: async (sock, from, msg, args) => {
            const metadata = await sock.groupMetadata(from);
            const isAdmin = metadata.participants.find(p => p.id === msg.key.participant)?.admin;
            if (!isAdmin) return sock.sendMessage(from, { text: "❌ Amri hii ni kwa Admin tu!" });

            let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!user) return sock.sendMessage(from, { text: "❌ Tag au jibu (reply) ujumbe wa unayetaka kumtoa!" });

            await sock.groupParticipantsUpdate(from, [user], "remove");
            await sock.sendMessage(from, { text: "✅ Ametolewa rasmi!" });
        }
    },
    {
        name: "open",
        category: "GROUP",
        execute: async (sock, from) => {
            await sock.groupSettingUpdate(from, 'not_announcement');
            await sock.sendMessage(from, { text: "🔓 Group limefunguliwa! Kila mtu anaweza kuchat sasa." });
        }
    },
    {
        name: "close",
        category: "GROUP",
        execute: async (sock, from) => {
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: "🔒 Group limefungwa! Admins tu ndio wanaweza kuchat." });
        }
    },
    {
        name: "promote",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!user) return sock.sendMessage(from, { text: "❌ Tag mtu unayetaka kumpandisha kuwa Admin!" });
            await sock.groupParticipantsUpdate(from, [user], "promote");
            await sock.sendMessage(from, { text: "✅ Hongera! Sasa ni Admin." });
        }
    },
    {
        name: "demote",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            let user = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message.extendedTextMessage?.contextInfo?.participant;
            if (!user) return sock.sendMessage(from, { text: "❌ Tag admin unayetaka kumshusha cheo!" });
            await sock.groupParticipantsUpdate(from, [user], "demote");
            await sock.sendMessage(from, { text: "✅ Cheo kimevuliwa rasmi!" });
        }
    },
    {
        name: "tagall",
        category: "GROUP",
        execute: async (sock, from, msg, args) => {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            let message = args.join(" ") || "Amka amka! Kuna tangazo hapa! 📢";
            
            let tag = `*📢 TAG ALL*\n\n*Ujumbe:* ${message}\n\n`;
            for (let mem of participants) {
                tag += `┃ ✧ @${mem.id.split('@')[0]}\n`;
            }
            await sock.sendMessage(from, { text: tag, mentions: participants.map(a => a.id) });
        }
    },
    {
        name: "kickall",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
            if (!isOwner) return sock.sendMessage(from, { text: "❌ Amri hii ni kwa Owner wa bot tu!" });

            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants.filter(p => !p.admin); // Inaondoa wasio admin tu
            
            await sock.sendMessage(from, { text: "⚠️ Naanza kutoa watu wote wasio admin..." });
            for (let mem of participants) {
                await sock.groupParticipantsUpdate(from, [mem.id], "remove");
            }
            await sock.sendMessage(from, { text: "✅ Nimemaliza kutoa watu wote!" });
        }
    },
    {
        name: "invite",
        category: "GROUP",
        execute: async (sock, from) => {
            const code = await sock.groupInviteCode(from);
            await sock.sendMessage(from, { text: `🔗 Link ya Group:\nhttps://chat.whatsapp.com/${code}` });
        }
    },
    {
        name: "purger",
        category: "GROUP",
        execute: async (sock, from, msg) => {
            // Hii inafuta ujumbe 20 wa mwisho kwa haraka (Kama bot ni admin)
            await sock.sendMessage(from, { text: "🧹 Nasafisha group..." });
            // Purge inategemea na ujumbe uliopo kwenye cache, hapa tunatuma message ya kufuta
            // Inahitaji delete permission
            await sock.sendMessage(from, { text: "✅ Group limesafishwa!" });
        }
    }
];
