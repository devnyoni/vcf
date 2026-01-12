module.exports = {
    name: "ping",
    async execute(sock, from, msg) {
        await sock.sendMessage(from, { text: "System Response: 100% Stable ⚡" }, { quoted: msg });
    }
};
