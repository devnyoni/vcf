module.exports = {
    name: "repo",
    category: "MAIN",
    desc: "Get the bot repository link",
    async execute(sock, from, msg, args) {
        const repoUrl = "https://github.com/Raheem-cm/RAHEEM-XMD-3";
        const forkUrl = "https://github.com/Raheem-cm/RAHEEM-XMD-3/fork";
        
        const repoInfo = `📂 *NYONI-XMD REPOSITORY* 📂

*Project Name:* RAHEEM-XMD-3 (Nyoni Edit)
*Developer:* NYONI
*Framework:* Baileys / Node.js

Click the link below to get the script, star the repo, or fork it to your own account.

📍 *Main Repo:* ${repoUrl}
🍴 *Fork Link:* ${forkUrl}

*Instructions:*
1. Give the repo a star ⭐
2. Click on 'Fork' to copy it.
3. Deploy on Heroku, Render, or VPS.

_Powered by Nyoni-XMD Engine_`;

        await sock.sendMessage(from, { 
            image: { url: "https://files.catbox.moe/t4ts87.jpeg" }, 
            caption: repoInfo,
            contextInfo: {
                externalAdReply: {
                    title: "GET THE BOT SCRIPT",
                    body: "Raheem-cm / RAHEEM-XMD-3",
                    thumbnailUrl: "https://files.catbox.moe/t4ts87.jpeg",
                    sourceUrl: repoUrl,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });
    }
};
