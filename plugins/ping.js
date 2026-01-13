const { performance } = require('perf_hooks');

module.exports = {
    name: "ping",
    category: "MAIN",
    execute: async (sock, from, msg) => {
        // Tunarekodi muda kabla ya kutuma ujumbe
        const start = performance.now();
        
        // Tunatuma ujumbe wa awali
        const { key } = await sock.sendMessage(from, { text: "Testing Nyoni-XMD Speed... 🚀" }, { quoted: msg });
        
        // Tunapiga hesabu ya kasi (ms)
        const speed = Math.round(performance.now() - start);

        // Tunabadilisha (Edit) ujumbe ule uonyeshe speed halisi
        await sock.sendMessage(from, { 
            text: `*🚀 NYONI-XMD SPEED*\n\n┃ ✧ *Latency:* ${speed} ms\n┃ ✧ *Status:* Online\n╰──────────┈`,
            edit: key 
        });
    }
};
