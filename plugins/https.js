module.exports = {
    name: "https",
    category: "REACTIONS",
    desc: "Show HTTP status cat images",
    async execute(sock, from, msg, args) {
        const code = args[0] || "404";
        const url = `https://http.cat/${code}.jpg`;
        await sock.sendMessage(from, { image: { url: url }, caption: `HTTP Status: ${code}` }, { quoted: msg });
    }
};
