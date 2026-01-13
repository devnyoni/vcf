module.exports = {
    name: "time",
    category: "TOOLS",
    desc: "Show current time and date",
    async execute(sock, from, msg, args) {
        // Fetch current date and time
        const now = new Date();
        
        // Options for formatting
        const timeOptions = { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit', 
            hour12: true, 
            timeZone: 'Africa/Dar_es_Salaam' 
        };
        
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            timeZone: 'Africa/Dar_es_Salaam' 
        };

        const currentTime = now.toLocaleTimeString('en-US', timeOptions);
        const currentDate = now.toLocaleDateString('en-US', dateOptions);

        let timeMsg = `🕒 *CURRENT TIME*\n\n`;
        timeMsg += `*Time:* ${currentTime}\n`;
        timeMsg += `*Date:* ${currentDate}\n`;
        timeMsg += `*Timezone:* EAT (GMT+3)\n\n`;
        timeMsg += `_Nyoni-XMD System Time_`;

        await sock.sendMessage(from, { 
            text: timeMsg,
            contextInfo: {
                externalAdReply: {
                    title: "NYONI-XMD CLOCK",
                    body: "Keeping you on track",
                    thumbnailUrl: "https://files.catbox.moe/t4ts87.jpeg",
                    sourceUrl: "https://nyoni-md-free.onrender.com",
                    mediaType: 1,
                    renderLargerThumbnail: false
                }
            }
        }, { quoted: msg });
    }
};
