 module.exports = {
    name: "owner",
    description: "Shows developer contact info",
    async execute(sock, from, msg) {
        const vcard = 'BEGIN:VCARD\n'
            + 'VERSION:3.0\n' 
            + 'FN:Nyoni-XMD Developer\n' 
            + 'ORG:Nyoni-XMD Bot;\n'
            + 'TEL;type=CELL;type=VOICE;waid=255610209120:+255 610 209 120\n'
            + 'END:VCARD';

        await sock.sendMessage(from, {
            contacts: {
                displayName: "Nyoni-XMD Owner",
                contacts: [{ vcard }]
            }
        }, { quoted: msg });
    }
};
