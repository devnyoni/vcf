const axios = require("axios");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const { exec } = require("child_process");

module.exports = {
    name: "trs",
    alias: ["transcribe", "stt"],
    category: "TOOLS",
    desc: "Badili Voice Note kuwa maandishi",
    async execute(sock, from, msg, args) {
        // 1. Angalia kama ni Voice Note (audioMessage)
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage || msg.message;
        const mime = quoted.audioMessage ? "audioMessage" : null;

        if (!mime) {
            return sock.sendMessage(from, { text: "❌ Tafadhali reply kwenye *Voice Note* ukitumia .trs" });
        }

        await sock.sendMessage(from, { react: { text: "🎧", key: msg.key } });

        try {
            // 2. Download Voice Note
            const stream = await downloadContentFromMessage(quoted[mime], 'audio');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            const inputFile = `./temp_${Date.now()}.ogg`;
            const outputFile = `./temp_${Date.now()}.mp3`;
            fs.writeFileSync(inputFile, buffer);

            // 3. Convert OGG kwenda MP3 (Wit.ai inakubali mp3/wav vizuri zaidi)
            exec(`ffmpeg -i ${inputFile} ${outputFile}`, async (err) => {
                if (err) return sock.sendMessage(from, { text: "❌ Ffmpeg error!" });

                const audioData = fs.readFileSync(outputFile);

                // 4. Tuma kwenda Wit.ai API
                const response = await axios({
                    method: 'POST',
                    url: 'https://api.wit.ai/speech',
                    params: { v: '20230215' },
                    headers: {
                        'Authorization': `Bearer WEKA_WIT_AI_TOKEN_HAPA`,
                        'Content-Type': 'audio/mpeg3'
                    },
                    data: audioData
                });

                const transcript = response.data.text || response.data[response.data.length -1]?.text;

                if (transcript) {
                    await sock.sendMessage(from, { 
                        text: `📝 *TRANSCRIPTION* 📝\n\n"${transcript}"\n\n_Translated by Nyoni-XMD_` 
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: "❌ Sauti haikueleweka, jaribu tena." });
                }

                // Futa ma-file ya muda
                fs.unlinkSync(inputFile);
                fs.unlinkSync(outputFile);
            });

        } catch (error) {
            console.error("STT Error:", error);
            await sock.sendMessage(from, { text: "❌ Server Error. Hakikisha Wit.ai Token ni sahihi." });
        }
    }
};
                  
