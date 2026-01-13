const axios = require("axios");

module.exports = [
    {
        name: "hack",
        category: "FUN",
        execute: async (sock, from, msg, args) => {
            const user = args[0] || "Target";
            const steps = [
                `💻 Connecting to *${user}* device...`,
                `🔍 System vulnerability found!`,
                `📥 Downloading private chats... 25%`,
                `📥 Downloading private chats... 75%`,
                `🔓 Accessing password database...`,
                `✅ *Hacking complete!* Control panel sent to your DMs.`
            ];
            const { key } = await sock.sendMessage(from, { text: "🚀 Initialization..." });
            for (let step of steps) {
                await new Promise(res => setTimeout(res, 1500));
                await sock.sendMessage(from, { text: step, edit: key });
            }
        }
    },
    {
        name: "rate",
        category: "FUN",
        execute: async (sock, from, msg, args) => {
            const target = args.join(" ") || "you";
            const percent = Math.floor(Math.random() * 101);
            await sock.sendMessage(from, { text: `📈 I rate *${target}* at *${percent}%*!` }, { quoted: msg });
        }
    },
    {
        name: "ship",
        category: "FUN",
        execute: async (sock, from, msg) => {
            const percent = Math.floor(Math.random() * 101);
            let status = percent > 70 ? "👩‍❤️‍👨 True Love!" : percent > 40 ? "😊 Friends" : "💔 No match";
            await sock.sendMessage(from, { text: `❤️ *LOVE TEST* ❤️\n\n┃ ✧ Result: *${percent}%*\n┃ ✧ Status: *${status}*\n╰──────────┈` }, { quoted: msg });
        }
    },
    {
        name: "joke",
        category: "FUN",
        execute: async (sock, from, msg) => {
            try {
                const res = await axios.get("https://official-joke-api.appspot.com/random_joke");
                await sock.sendMessage(from, { text: `🤣 *JOKE:* \n\n${res.data.setup}\n\n*${res.data.punchline}*` }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(from, { text: "❌ Failed to fetch joke." });
            }
        }
    },
    {
        name: "pickup",
        category: "FUN",
        execute: async (sock, from, msg) => {
            try {
                const res = await axios.get("https://vincent002.cp0.io/api/pickup"); // Mfano wa API
                await sock.sendMessage(from, { text: `🫦 *PICKUP LINE:* \n\n${res.data.result || "Are you a keyboard? Because you're just my type."}` }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(from, { text: "🫦 Are you a magician? Because whenever I look at you, everyone else disappears." });
            }
        }
    },
    {
        name: "insult",
        category: "FUN",
        execute: async (sock, from, msg) => {
            try {
                const res = await axios.get("https://evilinsult.com/generate_insult.php?lang=en&type=json");
                await sock.sendMessage(from, { text: `🔥 *INSULT:* \n\n${res.data.insult}` }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(from, { text: "❌ You're so slow, even a turtle would beat you in a race!" });
            }
        }
    },
    {
        name: "setpp",
        category: "FUN",
        execute: async (sock, from, msg) => {
            const isOwner = msg.key.fromMe || from.split('@')[0] === sock.user.id.split(':')[0];
            if (!isOwner) return;
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted || !quoted.imageMessage) return sock.sendMessage(from, { text: "❌ Reply to an image!" });
            
            // Kumbuka: Hii inahitaji downloadMedia logic kwenye index.js yako
            await sock.sendMessage(from, { text: "🛠️ Updating Profile Picture... (Owner Only)" });
        }
    }
];
                                       
