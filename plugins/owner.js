module.exports = {
    name: 'owner',
    async execute(sock, from) {
        const vcard = 'BEGIN:VCARD\n' + 'VERSION:3.0\n' + 'FN:Nyoni-xmd\n' + 'ORG:Developer;\n' + 'TEL;type=CELL;type=VOICE;waid=255610209120:+255610209120\n' + 'END:VCARD';
        await sock.sendMessage(from, { 
            contacts: { displayName: 'Nyoni-xmd', contacts: [{ vcard }] } 
        });
        await sock.sendMessage(from, { text: "Owner Name: Nyoni-xmd\nNumber: 255610209120" });
    }
};
