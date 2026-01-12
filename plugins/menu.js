module.exports = {
    name: "menu",
    description: "Dynamic automatic menu list",
    async execute(sock, from, msg, args, commands) {
        let menuText = `*─── 『 NYONI-XMD 』 ───*\n\n`;
        menuText += `*Total Features:* ${commands.size}\n\n`;
        menuText += `*COMMAND LIST:*\n`;

        // This loop automatically pulls every command name from your plugins folder
        commands.forEach((plugin, name) => {
            menuText += `✧ .${name}\n`;
        });

        menuText += `\n_The menu updates automatically when you add new plugins._`;

        await sock.sendMessage(from, { text: menuText }, { quoted: msg });
    }
};
