const axios = require("axios");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

module.exports = [
    {
        name: "sticker",
        category: "CONVERT",
        execute: async (sock, from, msg) => {
            const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) return sock.sendMessage(from, { text: "❌ Reply to an image or video!" });

            const type = Object.keys(quoted)[0];
            if (type !== 'imageMessage' && type !== 'videoMessage') return sock.sendMessage(from, { text: "❌ Reply to image/video only!" });

            await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } });
            
            // Kumbuka: Hapa unahitaji function ya kudownload media to buffer
            // Kwa sasa, hivi ndivyo unavyoweza kuituma kama sticker rahisi
            try {
                // Hii inafanya kazi kama una 'wa-sticker-formatter'
                // Kwa sasa nitakupa njia ya maandishi kama placeholder
                await sock.sendMessage(from, { text: "🛠️ Processing sticker... (Ensure ffmpeg is installed)" });
            } catch (e) {
                console.error(e);
            }
        }
    },
    {
        name: "fancy",
        category: "CONVERT",
        execute: async (sock, from, msg, args) => {
            const text = args.join(" ");
            if (!text) return sock.sendMessage(from, { text: "❌ Provide text!" });
            
            // Mfano rahisi wa fancy text
            const fancy = text.split('').map(char => {
                const table = { 'a': '𝓪', 'b': '𝓫', 'c': '𝓬', 'd': '𝓭', 'e': '𝓮' }; // Ongeza herufi zaidi
                return table[char.toLowerCase()] || char;
            }).join('');
            
            await sock.sendMessage(from, { text: `✨ *Fancy Text:* \n\n${fancy}` }, { quoted: msg });
        }
    },
    {
        name: "tinyurl",
        category: "CONVERT",
        execute: async (sock, from, msg, args) => {
            const link = args[0];
            if (!link) return sock.sendMessage(from, { text: "❌ Provide a URL!" });
            
            try {
                const res = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link)}`);
                await sock.sendMessage(from, { text: `🔗 *Shortened Link:* \n${res.data}` }, { quoted: msg });
            } catch (e) {
                await sock.sendMessage(from, { text: "❌ Failed to shorten URL." });
            }
        }
    },
    {
        name: "tts",
        category: "CONVERT",
        execute: async (sock, from, msg, args) => {
            const text = args.join(" ");
            if (!text) return sock.sendMessage(from, { text: "❌ Provide text to speak!" });
            
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;
            await sock.sendMessage(from, { audio: { url: ttsUrl }, mimetype: 'audio/mpeg', ptt: true }, { quoted: msg });
        }
    },
    {
        name: "readmore",
        category: "CONVERT",
        execute: async (sock, from, msg, args) => {
            const text1 = args.join(" ").split("|")[0] || "Text 1";
            const text2 = args.join(" ").split("|")[1] || "Text 2";
            const readMore = String.fromCharCode(8206).repeat(4001);
            await sock.sendMessage(from, { text: text1 + readMore + text2 });
        }
    },
    {
        name: "binary",
        category: "CONVERT",
        execute: async (sock, from, msg, args) => {
            const text = args.join(" ");
            if (!text) return sock.sendMessage(from, { text: "❌ Provide text!" });
            const binary = text.split('').map(char => char.charCodeAt(0).toString(2)).join(' ');
            await sock.sendMessage(from, { text: `🔢 *Binary:* \n\n${binary}` });
        }
    }
];
