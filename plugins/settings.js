module.exports = {
    name: "settings",
    description: "Toggle bot features",
    async execute(sock, from, msg, args) {
        if (args.length === 0) {
            let statusText = `*─── 『 NYONI-XMD SETTINGS 』 ───*\n\n`;
            statusText += `✧ Online: ${global.botSettings.alwaysOnline ? "✅" : "❌"}\n`;
            statusText += `✧ Typing: ${global.botSettings.autoType ? "✅" : "❌"}\n`;
            statusText += `✧ Recording: ${global.botSettings.autoRecord ? "✅" : "❌"}\n`;
            statusText += `✧ React: ${global.botSettings.autoReact ? "✅" : "❌"}\n`;
            statusText += `✧ Status: ${global.botSettings.autoStatus ? "✅" : "❌"}\n\n`;
            statusText += `*Usage:* .settings [feature] [on/off]\n`;
            statusText += `_Example: .settings typing on_`;
            return await sock.sendMessage(from, { text: statusText }, { quoted: msg });
        }

        const feature = args[0].toLowerCase();
        const action = args[1]?.toLowerCase();

        if (action !== "on" && action !== "off") return await sock.sendMessage(from, { text: "Use 'on' or 'off'!" });

        const state = action === "on";

        if (feature === "online") global.botSettings.alwaysOnline = state;
        else if (feature === "typing") global.botSettings.autoType = state;
        else if (feature === "recording") global.botSettings.autoRecord = state;
        else if (feature === "react") global.botSettings.autoReact = state;
        else if (feature === "status") global.botSettings.autoStatus = state;
        else return await sock.sendMessage(from, { text: "Unknown feature!" });

        await sock.sendMessage(from, { text: `Successfully turned ${feature} ${action}! ✅` });
    }
};
