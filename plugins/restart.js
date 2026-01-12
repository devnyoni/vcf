module.exports = {
    name: 'restart',
    async execute(sock, from) {
        const { key } = await sock.sendMessage(from, { text: 'Restarting NYONI-XMD...' });
        await sock.sendMessage(from, { text: 'Bot restarted successfully! ✅', edit: key });
        process.exit(); // Render itaiwasha upya yenyewe
    }
};
