require('dotenv').config();
const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require('discord.js');
const SelfbotClient = require('discord.js-selfbot-v13');
const mongoose = require('mongoose');
const fs = require('fs');
const express = require('express');
const app = express();
const port = 3001;



app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Panther</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          height: 100vh;
          background: linear-gradient(135deg, #1e1e2f, #3b3b5f);
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #ffffff;
        }
        h1 {
          font-size: 48px;
          background: -webkit-linear-gradient(#ff7e5f, #feb47b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-align: center;
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
        }
      </style>
    </head>
    <body>
      <h1>🐾 Welcome, Panther!</h1>
    </body>
    </html>
  `);
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const RESTART_FILE = './restart.json';

// MongoDB Setup
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB connection error:", err));

const AdminSchema = new mongoose.Schema({
    _id: { type: String, default: "singleton" },
    admins: [String],
    approvedmember: [String],
    everyone: Boolean
});

const AdminData = mongoose.model("AdminData", AdminSchema);

const ensureAdminData = async () => {
    const existing = await AdminData.findById("singleton");
    if (!existing) {
        await AdminData.create({
            _id: "singleton",
            admins: [process.env.DEFAULT_ADMIN_ID || "785501672998567956"],
            approvedmember: [],
            everyone: false
        });
    }
};

const getAdminData = async () => await AdminData.findById("singleton");
const saveAdminData = async (data) => await data.save();

const addAdmin = async (id) => {
    const data = await getAdminData();
    if (!data.admins.includes(id)) {
        data.admins.push(id);
        await saveAdminData(data);
    }
};

const addApprovedMembers = async (ids) => {
    const data = await getAdminData();
    ids.forEach(id => {
        if (!data.approvedmember.includes(id)) data.approvedmember.push(id);
    });
    await saveAdminData(data);
};

const removeApprovedMembers = async (ids) => {
    const data = await getAdminData();
    data.approvedmember = data.approvedmember.filter(id => !ids.includes(id));
    await saveAdminData(data);
};

const setEveryoneTracking = async (status) => {
    const data = await getAdminData();
    data.everyone = status;
    await saveAdminData(data);
};

console.log("🔍 Loading tokens from .env...\n");
const userTokens = [];
for (let i = 1; i <= 12; i++) {
    const varName = `USER_TOKEN_${i}`;
    const token = process.env[varName];
    if (token) {
        userTokens.push({ token, varName });
        console.log(`✅ ${varName} loaded`);
    } else {
        console.log(`❌ ${varName} missing`);
    }
}

const mainBot = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

const prefix = ".";
let skullActive = false;

mainBot.once('ready', async () => {
    console.log(`🤖 Logged in as ${mainBot.user.tag}`);
    await ensureAdminData();
    if (fs.existsSync(RESTART_FILE)) {
        try {
            const { restarting, channelId, messageId } = JSON.parse(fs.readFileSync(RESTART_FILE));
            if (restarting) {
                const channel = await mainBot.channels.fetch(channelId);
                const msg = await channel.messages.fetch(messageId);
                await msg.edit('✅ Bot restarted successfully.');
                fs.writeFileSync(RESTART_FILE, JSON.stringify({ restarting: false }, null, 2));
            }
        } catch (e) {
            console.error("Restart message edit failed:", e.message);
        }
    }
});

mainBot.login(process.env.BOT_TOKEN);

const userClients = [];

(async () => {
    for (const { token } of userTokens) {
        const client = new SelfbotClient.Client();
        try {
            await client.login(token);
            console.log(`👤 one piece in as ${client.user.username}`);
            userClients.push(client);
        } catch (err) {
            console.error(`Login failed: ${err.message}`);
        }
    }

    const selfbot2 = userClients[2];
    if (selfbot2) {
        selfbot2.on("messageCreate", async (msg) => {
            if (!skullActive) return;
            const data = await getAdminData();
            if (!data.everyone && !data.approvedmember.includes(msg.author.id)) return;

            try {
                const firstClient = userClients[0];
                const userChannel = await firstClient.channels.fetch(msg.channel.id);
                const target = await userChannel.messages.fetch(msg.id);

                const alreadySkulled = target.reactions.cache.some(r => r.emoji.name === '💀');

                if (alreadySkulled || !target.guild || target.guild.me?.permissionsIn(target.channel).has(PermissionsBitField.Flags.AddReactions)) {
                    for (let client of userClients) {
                        try {
                            const ch = await client.channels.fetch(msg.channel.id);
                            const m = await ch.messages.fetch(msg.id);
                            await m.react('💀');
                        } catch (e) {
                            console.error("Skull react failed:", e.message);
                        }
                    }
                }
            } catch (err) {
                console.error("Skull tracking error:", err.message);
            }
        });
    } else {
        console.warn("❌ selfbot2 is undefined. Ensure USER_TOKEN_3 is valid.");
    }
})();

mainBot.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.content.startsWith(prefix)) return;
    const data = await getAdminData();
    const isAdmin = data.admins.includes(msg.author.id);
    if (!isAdmin) return;

    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command === "ping") return msg.reply(`🏓 ${mainBot.ws.ping.toFixed(0)}ms`);

    if (command === "addadmin") {
        const id = args[0];
        if (!id) return msg.reply("❌ Provide valid user ID");
        await addAdmin(id);
        return msg.reply(`✅ Added admin: ${id}`);
    }

    if (command === "checktokens") {
        const statuses = userClients.map((c, i) => `✅ User ${i + 1}: ${c.user.username}`);
        return msg.reply("🧾 Token status:\n" + statuses.join("\n"));
    }
    if (command === "help") {
        return msg.reply(
            `📖 **Bot Help Menu**\n\n` +
            `**🔧 General Commands:**\n` +
            `• \`.ping\` - Check bot latency\n` +
            `• \`.restart\` - Restart the main bot\n\n` +
            `**👑 Admin Management:**\n` +
            `• \`.addadmin <user_id>\` - Add a user as bot admin\n` +
            `• \`.checktokens\` - Show which selfbots are logged in\n\n` +
            `**💀 Skull Tracking:**\n` +
            `• \`.skull @user(s)/<id(s)>\` - Start tracking messages from mentioned users\n` +
            `• \`.skull active\` - Enable skull reacting\n` +
            `• \`.skull stop\` - Disable skull reacting\n` +
            `• \`.skull all\` - Track everyone in server\n` +
            `• \`.skull all stop\` - Stop tracking everyone\n` +
            `• \`.skull list\` - View tracked user list\n` +
            `• \`.skull remove @user(s)/<id(s)>\` - Remove specific users from tracking\n` +
            `• \`.skull remove all\` - Remove all tracked users\n\n` +
            `ℹ️ For setup instructions, use \`.info\``
        );
    }
    
    if (command === "info") {
        return msg.reply(
            `ℹ️ **How Skull Tracking Works**\n\n` +
            `1️⃣ **Admin Setup**\n` +
            `• Only admins can use skull commands. Add yourself using: \`.addadmin <your_user_id>\`\n\n` +
    
            `2️⃣ **Tracking Users**\n` +
            `• Track specific users: \`.skull @user1 @user2\`\n` +
            `• Or track everyone: \`.skull all\`\n\n` +
    
            `3️⃣ **Activate/Stop Tracking**\n` +
            `• Start reacting: \`.skull active\`\n` +
            `• Stop reacting: \`.skull stop\`\n\n` +
    
            `4️⃣ **Reactions**\n` +
            `• When a tracked user sends a message, all selfbots will react with 💀\n\n` +
    
            `⚠️ **Important Notes:**\n` +
            `•  User1 (Luffy) must have permission to react in the server/channel\n` +
            `•  User2 (Zoro) must be in the server where tracking is happening\n` +
            `• The main bot doesn’t need to be in the target server — only the selfbots do\n` +
            `• Reactions are done via the selfbot(s), not the main bot\n\n` 
        );
    }
    

    if (command === "skull") {
        if (args[0] === "stop") {
            skullActive = false;
            return msg.reply("🚩 Skull tracking stopped.");
        }

        if (args[0] === "active") {
            skullActive = true;
            const data = await getAdminData();
            const count = data.approvedmember.length;
            const everyoneStatus = data.everyone ? "✅ Yes" : "❌ No";
            return msg.reply(`📁 **Skull Tracking Status:**\n• Tracked Users: \`${count}\`\n• Everyone Enabled: ${everyoneStatus}`);
        }

        if (args[0] === "remove") {
            if (args[1] === "all") {
                const data = await getAdminData();
                data.approvedmember = [];
                await saveAdminData(data);
                return msg.reply("🗑️ All ids removed.");
            }
            const ids = args.slice(1).map(arg => arg.replace(/[^0-9]/g, '')).filter(Boolean);
            if (!ids.length) return msg.reply("❌ Mention users or provide valid IDs to remove.");
            await removeApprovedMembers(ids);
            return msg.reply(`🗑️ Removed: ${ids.join(", ")}`);
        }

        if (args[0] === "all") {
            if (args[1] === "stop") {
                await setEveryoneTracking(false);
                return msg.reply("❌ Skull tracking for everyone stopped.");
            }
            await setEveryoneTracking(true);
            return msg.reply("💀 Skull tracking for everyone is now active.");
        }

        if (args[0] === "list") {
            const tracked = (await getAdminData()).approvedmember;
            if (!tracked.length) return msg.reply("📍 No users being tracked.");
            const lines = tracked.map(id => `<@${id}>`);
            return msg.reply("📋 **Skull Tracking List**:\n" + lines.join("\n"));
        }

        const ids = msg.mentions.users.map(u => u.id).concat(args.filter(a => /^\d{17,20}$/.test(a)));
        if (!ids.length) return msg.reply("❌ Mention users or provide valid IDs.");
        await addApprovedMembers(ids);
        return msg.reply(`💀 Tracking skulls for: ${ids.map(id => `<@${id}>`).join(", ")}`);
    }

    if (command === "restart") {
        const restartingMsg = await msg.reply("♻️ Restarting bot...");
        fs.writeFileSync(RESTART_FILE, JSON.stringify({ restarting: true, channelId: msg.channel.id, messageId: restartingMsg.id }, null, 2));
        const file = __filename; // full path of current script
        fs.utimesSync(file, new Date(), new Date()); // simulate file change
        process.exit(0);
    }
});
