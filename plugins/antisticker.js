module.exports = {
    name: 'antisticker',
    category: 'MODERATION',
    description: 'Control stickers in groups',
    async execute(sock, from, msg, args) {
        const isGroup = from.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender.split('@')[0] === sock.user.id.split(':')[0];

        if (!isGroup) {
            return sock.sendMessage(from, { 
                text: "❌ This command can only be used in groups!" 
            });
        }

        const metadata = await sock.groupMetadata(from);
        const isAdmin = metadata.participants.find(p => p.id === sender)?.admin;
        
        if (!isAdmin && !isOwner) {
            return sock.sendMessage(from, { 
                text: "❌ You need to be an admin to use this command!" 
            });
        }

        const subcommand = args[0]?.toLowerCase();
        
        switch(subcommand) {
            case 'on':
                global.botSettings.antiSticker = true;
                await sock.sendMessage(from, { 
                    text: "✅ Anti-sticker enabled!\n" +
                          "All stickers will be deleted and users will receive warnings." 
                });
                break;
                
            case 'off':
                global.botSettings.antiSticker = false;
                await sock.sendMessage(from, { 
                    text: "❌ Anti-sticker disabled.\n" +
                          "Stickers are now allowed." 
                });
                break;
                
            case 'ban':
                if (!global.botSettings.stickerBannedGroups.includes(from)) {
                    global.botSettings.stickerBannedGroups.push(from);
                }
                await sock.sendMessage(from, { 
                    text: "🚫 This group has been completely banned from sending stickers!" 
                });
                break;
                
            case 'unban':
                const index = global.botSettings.stickerBannedGroups.indexOf(from);
                if (index > -1) {
                    global.botSettings.stickerBannedGroups.splice(index, 1);
                }
                await sock.sendMessage(from, { 
                    text: "✅ Group removed from sticker ban list!" 
                });
                break;
                
            case 'warn':
                global.botSettings.stickerWarning = args[1]?.toLowerCase() === 'on';
                await sock.sendMessage(from, { 
                    text: `⚠️ Warning system: ${global.botSettings.stickerWarning ? 'ON' : 'OFF'}` 
                });
                break;
                
            case 'list':
                const bannedCount = global.botSettings.stickerBannedGroups.length;
                let listText = `*STICKER BAN LIST*\n\n`;
                listText += `Total Banned Groups: ${bannedCount}\n\n`;
                
                if (bannedCount > 0) {
                    for (const groupJid of global.botSettings.stickerBannedGroups) {
                        try {
                            const group = await sock.groupMetadata(groupJid);
                            listText += `• ${group.subject}\n`;
                        } catch {
                            listText += `• ${groupJid}\n`;
                        }
                    }
                } else {
                    listText += "No groups are banned from stickers.";
                }
                
                await sock.sendMessage(from, { text: listText });
                break;
                
            case 'reset':
                // Reset violations for specific user
                if (args[1]) {
                    const userJid = args[1].replace('@', '') + '@s.whatsapp.net';
                    stickerViolations.delete(userJid);
                    await sock.sendMessage(from, { 
                        text: `✅ Warnings for @${args[1]} have been cleared.`,
                        mentions: [userJid]
                    });
                } else {
                    // Reset all violations
                    stickerViolations.clear();
                    await sock.sendMessage(from, { 
                        text: "✅ All warnings have been cleared!" 
                    });
                }
                break;
                
            case 'time':
                const time = parseInt(args[1]);
                if (time && time >= 1 && time <= 60) {
                    global.botSettings.stickerTimeout = time * 60 * 1000;
                    await sock.sendMessage(from, { 
                        text: `⏳ Mute time changed to ${time} minutes.` 
                    });
                } else {
                    await sock.sendMessage(from, { 
                        text: "❌ Please set a time between 1-60 minutes." 
                    });
                }
                break;
                
            case 'stats':
                const violationsCount = stickerViolations.size;
                let statsText = `*STICKER VIOLATION STATISTICS*\n\n`;
                statsText += `Total Users with Violations: ${violationsCount}\n`;
                statsText += `Active Ban List: ${global.botSettings.stickerBannedGroups.length} groups\n\n`;
                
                if (violationsCount > 0) {
                    statsText += `*Recent Violators:*\n`;
                    let count = 0;
                    for (const [userJid, data] of stickerViolations.entries()) {
                        if (count >= 10) break; // Show only top 10
                        statsText += `• @${userJid.split('@')[0]} - ${data.count} violation(s)\n`;
                        count++;
                    }
                }
                
                await sock.sendMessage(from, { 
                    text: statsText,
                    mentions: Array.from(stickerViolations.keys()).slice(0, 10)
                });
                break;
                
            default:
                const status = global.botSettings.antiSticker ? '✅ ON' : '❌ OFF';
                const warning = global.botSettings.stickerWarning ? 'ON' : 'OFF';
                const muteTime = global.botSettings.stickerTimeout / (60 * 1000);
                
                await sock.sendMessage(from, { 
                    text: `*ANTI-STICKER SETTINGS*\n\n` +
                          `Status: ${status}\n` +
                          `Warning System: ${warning}\n` +
                          `Mute Time: ${muteTime} minutes\n` +
                          `Banned Groups: ${global.botSettings.stickerBannedGroups.length}\n` +
                          `Active Violations: ${stickerViolations.size}\n\n` +
                          `*Commands:*\n` +
                          `• .antisticker on/off\n` +
                          `• .antisticker warn on/off\n` +
                          `• .antisticker ban/unban\n` +
                          `• .antisticker list\n` +
                          `• .antisticker reset [@user]\n` +
                          `• .antisticker time [minutes]\n` +
                          `• .antisticker stats` 
                });
        }
    }
};
