const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay 
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const express = require('express'); // Ongeza hii
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Hii ndio API ya kutoa kodi
app.get('/get-code', async (req, res) => {
    let num = req.query.number;
    if (!num) return res.json({ error: "Weka namba!" });

    const { state, saveCreds } = await useMultiFileAuthState('session');
    const conn = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!conn.authState.creds.registered) {
        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const code = await conn.requestPairingCode(num);
        res.json({ code: code });
    } else {
        res.json({ error: "Boti tayari imeshaunganishwa!" });
    }
});

app.listen(port, () => console.log(`Server inayocheza kwenye port ${port}`));

// ... (Kodi yako ya ku-view status iendelee chini hapa)
