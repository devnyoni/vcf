
module.exports = {
    name: "play",
    category: "DOWNLOAD",
    execute: async (sock, from, msg, args) => {
        try {
            const query = args.join(" ");
            if (!query) return await sock.sendMessage(from, { text: "❌ *Please provide a song name or URL!*" }, { quoted: msg });

            // Search YouTube for the video
            const search = await yts(query);
            const data = search.videos[0];
            if (!data) return await sock.sendMessage(from, { text: "❌ *No results found!*" }, { quoted: msg });

            const fancyMsg = `
╔══════════════════════╗
     ♪  *𝐘𝐎𝐔𝐓𝐔𝐁𝐄  𝐏𝐋𝐀𝐘𝐄𝐑* ♪
╠══════════════════════╣
  ➪ *ᴛɪᴛʟᴇ:* ${data.title}
  ➪ *ᴅᴜʀᴀᴛɪᴏɴ:* ${data.timestamp}
  ➪ *ᴠɪᴇᴡꜱ:* ${data.views.toLocaleString()}
  ➪ *ᴜᴘʟᴏᴀᴅᴇʀ:* ${data.author.name}
╠══════════════════════╣
        *ꜱᴇʟᴇᴄᴛ ꜰᴏʀᴍᴀᴛ:*
  
  [1] ➪ 𝐀𝐮𝐝𝐢𝐨 (𝐌𝐮𝐬𝐢𝐜) 🎵
  [2] ➪ 𝐃𝐨𝐜𝐮𝐦𝐞𝐧𝐭 (𝐅𝐢𝐥𝐞) 📂
  [3] ➪ 𝐕𝐨𝐢𝐜𝐞 𝐍𝐨ｔ𝐞 (𝐏𝐓𝐓) 🎤
╚══════════════════════╝
*Reply with a number to download*`;

            const sentMsg = await sock.sendMessage(from, { 
                image: { url: data.thumbnail }, 
                caption: fancyMsg 
            }, { quoted: msg });

            // Logic to handle the reply/selection
            sock.ev.on('messages.upsert', async (msgUpdate) => {
                const m = msgUpdate.messages[0];
                if (!m.message) return;
                
                const selectedText = (m.message.conversation || m.message.extendedTextMessage?.text || "").trim();
                const context = m.message.extendedTextMessage?.contextInfo;

                // Check if the user is replying to the menu message sent by the bot
                if (context && context.stanzaId === sentMsg.key.id) {
                    if (["1", "2", "3"].includes(selectedText)) {
                        
                        // Add a reaction to show processing
                        await sock.sendMessage(from, { react: { text: "📥", key: m.key } });

                        // External API for downloading
                        const apiUrl = `https://api.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(data.url)}`;
                        const response = await fetch(apiUrl);
                        const json = await response.json();
                        
                        if (!json.success) {
                            return await sock.sendMessage(from, { text: "❌ *API Error! Please try again later.*" }, { quoted: m });
                        }

                        const downloadUrl = json.result.download_url;

                        if (selectedText === "1") {
                            // Standard Audio
                            await sock.sendMessage(from, { 
                                audio: { url: downloadUrl }, 
                                mimetype: 'audio/mpeg' 
                            }, { quoted: m });
                        } else if (selectedText === "2") {
                            // Document File
                            await sock.sendMessage(from, { 
                                document: { url: downloadUrl }, 
                                mimetype: 'audio/mpeg', 
                                fileName: `${data.title}.mp3` 
                            }, { quoted: m });
                        } else if (selectedText === "3") {
                            // Voice Note (PTT)
                            await sock.sendMessage(from, { 
                                audio: { url: downloadUrl }, 
                                mimetype: 'audio/mpeg', 
                                ptt: true 
                            }, { quoted: m });
                        }
                        
                        // Success Reaction
                        await sock.sendMessage(from, { react: { text: "✅", key: m.key } });
                    }
                }
            });

        } catch (e) {
            console.error("Play Command Error:", e);
            await sock.sendMessage(from, { text: "❌ *An error occurred while processing your request!*" });
        }
    }
};
