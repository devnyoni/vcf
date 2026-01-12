module.exports = {
    name: "group",
    description: "Open or Close group chat",
    async execute(sock, from, msg, args) {
        if (args[0] === 'open') {
            await sock.groupSettingUpdate(from, 'not_announcement');
            await sock.sendMessage(from, { text: "Group opened. Everyone can send messages. 🔓" });
        } else if (args[0] === 'close') {
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: "Group closed. Only admins can send messages. 🔒" });
        } else {
            await sock.sendMessage(from, { text: "Use: .group open OR .group close" });
        }
    }
};
