module.exports = {
    name: "lach",
    alias: ["lastchat", "soma"],
    category: "TOOLS",
    desc: "Soma chat za mwisho za mtu uliyem-mention bila kutumia store",
    async execute(sock, from, msg, args) {
        // 1. Pata mtu aliyetajwa (Mentioned)
        let target;
        if (msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (msg.message.extendedTextMessage?.contextInfo?.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        }

        if (!target) {
            return sock.sendMessage(from, { text: "⚠️ M-tag mtu unayetaka kusoma chat zake.\nMfano: .lach @jina" });
        }

        await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });

        try {
            // 2. Omba historia ya mechi 50 za mwisho kwenye kundi kutoka WhatsApp
            // Hatuhitaji kugusa index.js hapa
            const history = await sock.fetchMessageHistory(50, msg.key, msg.messageTimestamp);

            if (!history || history.length === 0) {
                return sock.sendMessage(from, { text: "📭 Sikuweza kupata historia ya chat kwenye kundi hili." });
            }

            // 3. Chuja meseji za huyo mtu pekee
            const userMsgs = history
                .filter(m => m.key.participant === target || m.key.remoteJid === target)
                .slice(-5); // Chukua 5 za mwisho alizotuma

            if (userMsgs.length === 0) {
                return sock.sendMessage(from, { text: "❌ Huyo mtu hajaongea chochote kwenye mechi 50 zilizopita." });
            }

            let response = `📜 *LAST CHATS: @${target.split('@')[0]}* 📜\n\n`;
            
            userMsgs.forEach((m, i) => {
                const text = m.message?.conversation || 
                             m.message?.extendedTextMessage?.text || 
                             "_(Media/Sticker/File)_";
                response += `*${i + 1}.* ${text}\n`;
            });

            await sock.sendMessage(from, { 
                text: response, 
                mentions: [target] 
            }, { quoted: msg });

            await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });

        } catch (error) {
            console.error("Lach Error:", error);
            await sock.sendMessage(from, { text: "❌ Hitilafu: WhatsApp imekataa kutoa historia kwa sasa." });
        }
    }
};
