module.exports = {
    name: 'ping', // This name will appear in the menu automatically
    async execute(sock, msg, from, { prefix }) {
        await sock.sendMessage(from, { 
            image: { url: global.botSettings.menuImage }, 
            caption: `🚀 *NYONI-XMD PING:* ${Date.now() - msg.messageTimestamp * 1000}ms` 
        }, { quoted: msg });
    }
};
