const googleTTS = require("google-tts-api");

module.exports = {
    name: "tts",
    category: "TOOLS",
    desc: "Convert text to a voice note (Audio)",
    async execute(sock, from, msg, args) {
        // 1. Get the text from arguments or quoted message
        let text = args.join(" ");
        if (!text && msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
            text = msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation || 
                   msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text;
        }

        if (!text) {
            return sock.sendMessage(from, { text: "Usage: .tts [text] or reply to a message with .tts" });
        }

        // 2. Limit text length (Google TTS limit is 200 chars per request)
        if (text.length > 200) {
            return sock.sendMessage(from, { text: "Text is too long! Keep it under 200 characters." });
        }

        try {
            // 3. Generate the TTS URL (Default language: English 'en')
            // You can change 'en' to 'sw' for Swahili
            const url = googleTTS.getAudioUrl(text, {
                lang: 'en',
                slow: false,
                host: 'https://translate.google.com',
            });

            // 4. Send the audio as a voice note (PTT)
            await sock.sendMessage(from, { 
                audio: { url: url }, 
                mimetype: 'audio/mp4', 
                ptt: true 
            }, { quoted: msg });

        } catch (error) {
            console.error("TTS Error:", error);
            await sock.sendMessage(from, { text: "❌ Failed to generate audio. Please try again." });
        }
    }
};
