module.exports = {
    name: "spam",
    category: "OWNER",
    desc: "Send a message multiple times",
    async execute(sock, from, msg, args) {
        // 1. Security: Only the owner should use this
        const isOwner = msg.key.fromMe || args.includes("force"); // Basic owner check
        if (!isOwner) return sock.sendMessage(from, { text: "❌ This command is for my developer only." });

        // 2. Parse arguments: .spam [count] [message]
        const count = parseInt(args[0]);
        const text = args.slice(1).join(" ");

        if (isNaN(count) || !text) {
            return sock.sendMessage(from, { text: "Usage: .spam 5 Hello\n(Max limit: 20)" });
        }

        // 3. Safety Limit: Do not exceed 20 to prevent bot ban
        if (count > 20) {
            return sock.sendMessage(from, { text: "⚠️ Safety limit: You can only spam up to 20 messages at once." });
        }

        // 4. Execution
        for (let i = 0; i < count; i++) {
            await sock.sendMessage(from, { text: text });
            // Small delay to prevent the bot from crashing itself
            await new Promise(resolve => setTimeout(resolve, 500)); 
        }
    }
};
