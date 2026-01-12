module.exports = {
    name: "menu",
    description: "Automatically lists all available commands",
    async execute(sock, from, msg, args, commands) {
        // This 'commands' Map is passed from index.js automatically
        
        let menuText = `*─── 『 NYONI-XMD MENU 』 ───*\n\n`;
        menuText += `*Available Commands:* \n`;

        // Loop through the commands Map to build the list automatically
        commands.forEach((plugin, name) => {
            menuText += `  ✧ .${name}\n`;
        });

        menuText += `\n*Total Commands:* ${commands.size}\n`;
        menuText += `_Powered by Nyoni-XMD_`;

        await sock.sendMessage(from, { 
            text: menuText,
            contextInfo: {
                externalAdReply: {
                    title: "NYONI-XMD AUTOMATIC SYSTEM",
                    body: "The bot is active",
                    sourceUrl: "https://github.com/devnyoni/vcf",
                    mediaType: 1,
                    renderLargerThumbnail: false
                }
            }
        }, { quoted: msg });
    }
};
