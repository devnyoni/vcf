 module.exports = {
    name: 'ping',
    async execute(sock, from) {
        const start = Date.now();
        const { key } = await sock.sendMessage(from, { text: 'Testing...' });
        const end = Date.now();
        await sock.sendMessage(from, { text: `Pong! 🚀\nSpeed: ${end - start}ms`, edit: key });
    }
};
