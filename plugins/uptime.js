module.exports = {
    name: "uptime",
    category: "MAIN",
    execute: async (sock, from, msg) => {
        // Calculate uptime in seconds
        const uptimeSeconds = process.uptime();
        
        // Convert seconds into Days, Hours, Minutes, and Seconds
        const days = Math.floor(uptimeSeconds / (3600 * 24));
        const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);

        // Formatting the time string
        let uptimeString = "";
        if (days > 0) uptimeString += `${days}d `;
        uptimeString += `${hours}h ${minutes}m ${seconds}s`;

        const uptimeMessage = `*╭┈〔 🕒 NYONI-XMD UPTIME 〕┈─*
┃ ✧ *Status:* Online 🚀
┃ ✧ *Runtime:* ${uptimeString}
┃ ✧ *Server:* Render (Active)
╰──────────┈`;

        await sock.sendMessage(from, { 
            text: uptimeMessage 
        }, { quoted: msg });
    }
};
