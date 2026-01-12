module.exports = {
    name: "restart",
    description: "Reboots the bot system",
    async execute(sock, from, msg) {
        const { remoteJid } = msg.key;

        // Send a confirmation message before restarting
        await sock.sendMessage(from, { 
            text: "*NYONI-XMD RESTARTING...* 🔄\n\nPlease wait a few moments for the system to reconnect." 
        }, { quoted: msg });

        // Small delay to ensure the message is sent before the process exits
        setTimeout(() => {
            process.exit(); 
            // In a Docker/Render environment, the system will 
            // automatically catch the exit and restart the container.
        }, 3000);
    }
};
