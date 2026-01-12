module.exports = {
    name: 'menu',
    async execute(sock, from) {
        let menuText = `*┏━━━‹ NYONI-XMD ›━━━┓*\n\n`;
        menuText += `┃ ✧ ,ping\n┃ ✧ ,speed\n┃ ✧ ,alive\n┃ ✧ ,uptime\n┃ ✧ ,owner\n┃ ✧ ,nyoni\n┃ ✧ ,menu\n┃ ✧ ,restart\n\n`;
        menuText += `*┗━━━━━━━━━━━━━━┛*`;
        await sock.sendMessage(from, { 
            image: { url: 'https://files.catbox.moe/p9z9v3.jpg' }, 
            caption: menuText 
        });
    }
}
