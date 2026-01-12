const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    fetchLatestBaileysVersion 
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

console.log(`
░█▄░█░█░█░█▀█░█▀█░▀█▀░░░▀▄░▄▀░█▀█
░█░▀█░▀▄▀░█░█░█░█░░█░░░░░▀▄▀░░█▀▄
░▀░░▀░░▀░░▀▀▀░▀░▀░▀▀▀░░░▀▄░▄▀░▀░▀
    NYONI X-R IS STARTING...
`);

// ... (Kodi nyingine tulizoweka mwanzo za get-code na auto-view)
