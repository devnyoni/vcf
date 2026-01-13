module.exports = {
    name: "nyoni",
    category: "MAIN",
    desc: "Details about the Developer",
    async execute(sock, from, msg, args) {
        // Developer details
        const devName = "NYONI";
        const github = "https://github.com/Nyoni-xmd";
        const web = "https://nyoni-md-free.onrender.com";
        const status = "Active 💻";
        const location = "Tanzania 🇹🇿";

        const devInfo = `👤 *DEVELOPER PROFILE* 👤

*Name:* ${devName}
*Role:* Lead Developer & Founder
*Status:* ${status}
*Location:* ${location}

*Social & Links:*
🔗 *GitHub:* ${github}
🌐 *Website:* ${web}

*About:*
Passionate about building high-performance WhatsApp bots and automation tools. NYONI-XMD is built for speed, security, and fun.

_“Coding is the language of the future.”_`;

        await sock.sendMessage(from, { 
            image: { url: "https://files.catbox.moe/t4ts87.jpeg" }, // Your Dev Image
            caption: devInfo,
            contextInfo: {
                externalAdReply: {
                    title: "NYONI-XMD OFFICIAL DEV",
                    body: "System Administrator",
                    thumbnailUrl: "https://files.catbox.moe/t4ts87.jpeg",
                    sourceUrl: web,
                    mediaType: 1,
                    renderLargerThumbnail: true
                }
            }
        }, { quoted: msg });
    }
};
