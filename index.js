require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    PermissionsBitField
} = require('discord.js');
const SelfbotClient = require('discord.js-selfbot-v13');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({
    default: fetch
}) => fetch(...args));

const express = require('express');
const app = express();
const port = 3001;


// Serve static files and parse JSON
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));



// Endpoint to serve the manual captcha solver page
app.get('/captcha', (req, res) => {
    const requestPath = path.join(__dirname, 'captcha_request.json');
    if (!fs.existsSync(requestPath)) {
        return res.send("<h2>No CAPTCHA request detected yet.</h2>");
    }

    const payload = JSON.parse(fs.readFileSync(requestPath));
    const sitekey = payload.captcha_sitekey; // 🔧 Make sure this matches key from JSON

    if (!sitekey) return res.send("<h2>Invalid sitekey. Cannot render hCaptcha.</h2>");

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Solve hCaptcha</title>
      <script src="https://hcaptcha.com/1/api.js" async defer></script>
    </head>
    <body>
      <h1>Solve CAPTCHA</h1>
      <form id="captchaForm">
        <div class="h-captcha" data-sitekey="${sitekey}" data-callback="onCaptchaSuccess"></div>
        <input type="hidden" id="token" name="token">
      </form>
      <script>
        function onCaptchaSuccess(token) {
          fetch('/captcha/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          }).then(() => alert('✅ Captcha submitted.'));
        }
      </script>
    </body>
    </html>
  `);
});

// Endpoint to receive the solved token
app.post('/captcha/token', (req, res) => {
    const token = req.body.token;
    if (!token) return res.status(400).send('No token provided.');

    fs.writeFileSync('./captcha_token.json', JSON.stringify({
        token
    }, null, 2));
    res.sendStatus(200);
});

// Start the web server (port 3001 already in use)
app.listen(3002, () => {
    console.log('🧩 Manual solver running ..');
});


// Then update your selfbot captchaSolver
const captchaSolver = async (captcha, userAgent) => {
    console.log("⚠️ CAPTCHA triggered! Waiting for manual solve...");
    fs.writeFileSync('./captcha_request.json', JSON.stringify({
        captcha_sitekey: captcha.captcha_sitekey,
        captcha_rqdata: captcha.captcha_rqdata,
        userAgent,
        timestamp: Date.now()
    }, null, 2));

    // Wait for token
    while (!fs.existsSync('./captcha_token.json')) {
        await new Promise(res => setTimeout(res, 1000));
    }

    const tokenData = JSON.parse(fs.readFileSync('./captcha_token.json'));
    fs.unlinkSync('./captcha_token.json');

    return tokenData.token;
};


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
    _id: {
        type: String,
        default: "singleton"
    },
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

// AFK Schema Addition
const AfkSchema = new mongoose.Schema({ afkadmin: [String] });
const AfkData = mongoose.model("AfkData", AfkSchema);

const FollowSchema = new mongoose.Schema({ followadmins: [{ userid: String, count: Number }] });
const FollowData = mongoose.model("FollowData", FollowSchema);

const ensureFollowData = async () => {
  const exists = await FollowData.findOne();
  if (!exists) await FollowData.create({ followadmins: [] });
};

const setFollowAdmin = async (userid, count = 5) => {
  let data = await FollowData.findOne();
  const existing = data.followadmins.find(f => f.userid === userid);
  if (existing) {
    existing.count = count;
  } else {
    data.followadmins.push({ userid, count });
  }
  await data.save();
};

const removeFollowAdmin = async (userid) => {
  let data = await FollowData.findOne();
  data.followadmins = data.followadmins.filter(f => f.userid !== userid);
  await data.save();
};

const getFollowAdmins = async () => {
  const data = await FollowData.findOne();
  return data?.followadmins || [];
};


const ensureAfkData = async () => {
  const exists = await AfkData.findOne();
  if (!exists) await AfkData.create({ afkadmin: [] });
};

const addAfkUser = async (id) => {
  let data = await AfkData.findOne();
  if (!data) data = await AfkData.create({ afkadmin: [] });
  if (!data.afkadmin.includes(id)) {
    data.afkadmin.push(id);
    await data.save();
  }
};


const removeAfkUser = async (id) => {
  let data = await AfkData.findOne();
  if (!data) return;

  if (!data.afkadmin.includes(id)) return;

  // Remove the ID and re-save
  data.afkadmin = data.afkadmin.filter(i => i !== id);

  // ✅ Use `findByIdAndUpdate` to avoid version mismatch
  await AfkData.findByIdAndUpdate(data._id, { afkadmin: data.afkadmin });
};

const getAfkUsers = async () => {
  const data = await AfkData.findOne();
  return data?.afkadmin || [];
};

// Call once on bot start
ensureAfkData();
ensureFollowData();
const sendReply = async (msg, content, isMainbot = false) => {
    if (isMainbot) {
        try {
            const ch = await mainBot.channels.fetch(msg.channel.id);
            const fetchedMsg = await ch.messages.fetch(msg.id); // Fetch the original message
            await fetchedMsg.reply(content); // Reply to it
            console.log(`✅ Replied via main bot (${mainBot.user.username})`);
            return;
        } catch (err) {
            console.error(`❌ Main bot failed to reply: ${err.message}`);
            return;
        }
    }

    if (userClients.length === 0) {
        console.error("⚠️ No selfbots available.");
        return;
    }

    const randomClient = userClients[Math.floor(Math.random() * userClients.length)];

    try {
        const ch = await randomClient.channels.fetch(msg.channel.id);
        const fetchedMsg = await ch.messages.fetch(msg.id); // Fetch the original message
        await fetchedMsg.reply(content); // Reply to it
        console.log(`✅ Replied via ${randomClient.user.username}`);
    } catch (err) {
        console.error(`❌ ${randomClient.user.username} failed to reply: ${err.message}`);
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
        userTokens.push({
            token,
            varName
        });
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
            const {
                restarting,
                channelId,
                messageId
            } = JSON.parse(fs.readFileSync(RESTART_FILE));
            if (restarting) {
                const channel = await mainBot.channels.fetch(channelId);
                const msg = await channel.messages.fetch(messageId);
                await msg.edit('✅ Bot restarted successfully.');
                fs.writeFileSync(RESTART_FILE, JSON.stringify({
                    restarting: false
                }, null, 2));
            }
        } catch (e) {
            console.error("Restart message edit failed:", e.message);
        }
    }
});

mainBot.login(process.env.BOT_TOKEN);


const userClients = [];

(async () => {
    for (const {
            token
        }
        of userTokens) {
        const client = new SelfbotClient.Client({
            captchaSolver: async (captcha, userAgent) => {
                console.log("⚠️ CAPTCHA triggered! Waiting for manual solve...");

                const fs = require('fs');

                fs.writeFileSync('./captcha_request.json', JSON.stringify({
                    captcha_sitekey: captcha.captcha_sitekey,
                    captcha_rqdata: captcha.captcha_rqdata,
                    userAgent,
                    timestamp: Date.now()
                }, null, 2));
                const captchaURL = `${process.env.CAPTCHA_HOST_URL}/captcha`; // or your hosted URL
                await sendCaptchaLink(latestCommandMessage, captchaURL, targetSelfbotClient);
                while (!fs.existsSync('./captcha_token.json')) {
                    await new Promise(res => setTimeout(res, 1000));
                }

                const tokenData = JSON.parse(fs.readFileSync('./captcha_token.json'));
                fs.unlinkSync('./captcha_token.json');
                return tokenData.token;
            },
            TOTPKey: null,
            checkUpdate: false
        });

        try {
            await client.login(token);
            console.log(`👤 one piece in as ${client.user.username}`);
            userClients.push(client);
        } catch (err) {
            console.error(`Login failed: ${err.message}`);
        }
    }
    const selfbot0 = userClients[0];
  if (selfbot0) {
    selfbot0.on("messageCreate", async (msg) => {
  if (msg.author.bot) return;

  const afkUsers = await getAfkUsers();

  // Check for AFK mentions
  if (msg.mentions.users.size > 0) {
    for (const [id, user] of msg.mentions.users) {
      if (afkUsers.includes(id)) {
        try {
          await msg.react("🇦");
          await msg.react("🇫");
          await msg.react("🇰");
        } catch (e) {
          console.error("AFK React Error:", e.message);
        }
      }
    }
  }
  if (afkUsers.includes(msg.author.id)) {
    await removeAfkUser(msg.author.id);
  }
    });
};

    const selfbot2 = userClients[2];
    if (selfbot2) {
        selfbot2.on("messageCreate", async (msg) => {
            if (msg.author.bot || !msg.content.startsWith(prefix)) return;
            const data = await getAdminData();
            // ✅ Ignore if main bot is already in this guild
            if (msg.guild && mainBot.guilds.cache.has(msg.guild.id)) return;
            const isAdmin = data.admins.includes(msg.author.id);
            if (!isAdmin) return;
            try {
                await commands(msg, data);
            } catch (err) {
                console.error("Command error:", err.message);
                msg.reply(`❌ Error executing command: ${err.message}`);
            }

        })


selfbot2.on("messageReactionAdd", async (reaction, user) => {
    if (user.bot) return;
    const followAdmins = await getFollowAdmins();
    const admin = followAdmins.find(f => f.userid === user.id);
    if (!admin) return;

    try {
      const shuffled = userClients.slice(1).sort(() => Math.random() - 0.5); // randomize remaining 11
      const reactors = [userClients[0], ...shuffled.slice(0, admin.count - 1)];
      for (const bot of reactors) {
        try {
          const ch = await bot.channels.fetch(reaction.message.channelId);
          const msg = await ch.messages.fetch(reaction.message.id);
          await msg.react(reaction.emoji);
        } catch (err) {
          console.error("Follow react error:", err.message);
        }
      }
    } catch (err) {
      console.error("Follow logic failed:", err.message);
    }
  });

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


async function commands(msg, data, isMainbot = false) {
    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    if (command === "ping") return sendReply(msg, `🏓 ${mainBot.ws.ping.toFixed(0)}ms`, isMainbot);


    if (command === "addadmin") {
        const id = args[0];
        if (!id) return msg.reply("❌ Provide valid user ID");
        await addAdmin(id);
        return sendReply(msg, `✅ Added admin: ${id}`, isMainbot);
    }

    if (command === "checktokens") {
        const statuses = userClients.map((c, i) => `✅ User ${i + 1}: ${c.user.username}`);
        return sendReply(msg, "🧾 Token status:\n" + statuses.join("\n"), isMainbot);
    }
    if (command === "help") {
        return sendReply(msg,
            `📖 **Panther Bot Help Menu**

🔧 **General**
• \`.ping\` — Check main bot latency
• \`.restart\` — Restart the main bot
• \`.checktokens\` — Show which selfbots are online

👑 **Admin**
• \`.addadmin <user_id>\` — Add user as bot admin

🧠 **Messaging**
• \`.msg -s:<server_id> -c:<channel_id> -b:<selfbot_user_id> <message>\`  
   → Send message via selfbot to a specific channel

🧍 **Profile Management**
• \`.name <selfbot_user_id> <new name>\`  
   → Change global name (nickname visible in all servers)
• \`.pfp <selfbot_user_id>\` (reply to image)  
   → Change profile picture of a selfbot

💰 **Bankrob Button Joiner**
• \`.joinbr -s:<server_id> -c:<channel_id> -m:<message_id>\`  
   → All selfbots click the **JOIN BANKROB** button in a message

💀 **Skull Tracker**
• \`.skull @user(s)/<id(s)>\` — Start tracking their messages
• \`.skull active\` — Start skull reacting
• \`.skull stop\` — Stop skull reacting
• \`.skull all\` — Track everyone in the server
• \`.skull all stop\` — Stop tracking everyone
• \`.skull list\` — View currently tracked users
• \`.skull remove @user(s)/<id(s)>\` — Remove users from tracking
• \`.skull remove all\` — Clear all tracked users
• \`.afk\` — Assistant will react with AFK

🔁 **Follow Mode**
• \`.follow\` — Bots will mimic your reactions with 5 bots by default
• \`.follow <1–12>\` — Set custom follow count
• \`.follow stop\` — Stop follow reactions 


ℹ️ Use \`.info\` to understand how skull tracking works.`,
            isMainbot);
    }

    if (command === "info") {
        return sendReply(msg,
            `ℹ️ **Skull Tracking Explanation**

1️⃣ **Admin Setup**
• Only added admins can run skull commands.
• Use \`.addadmin <your_user_id>\` once to become admin.

2️⃣ **Tracking Users**
• To track certain people: \`.skull @user1 @user2\`
• To track everyone: \`.skull all\`

3️⃣ **Control Tracking**
• Enable reactions: \`.skull active\`
• Disable reactions: \`.skull stop\`
• Stop tracking everyone: \`.skull all stop\`

4️⃣ **Reactions**
• When a tracked user sends a message, all selfbots react with 💀

⚠️ **Requirements**
• First selfbot (user 1) must have permission to react
• All selfbots must be in the server where tracking is happening
• The main bot is only used to manage — selfbots do the reacting`,
            isMainbot);
    }

    if (command === "msg") {
        const serverArg = args.find(a => a.startsWith("-s:"));
        const channelArg = args.find(a => a.startsWith("-c:"));
        const botArg = args.find(a => a.startsWith("-b:"));

        if (serverArg && channelArg && botArg) {
            const serverId = serverArg.split(":")[1];
            const channelId = channelArg.split(":")[1];
            const botUserId = botArg.split(":")[1];
            const message = args.filter(a => !a.startsWith("-s:") && !a.startsWith("-c:") && !a.startsWith("-b:")).join(" ");
            if (!serverId || !channelId || !botUserId || !message) return sendReply(msg, "❌ Usage: .msg -s:serverid -c:channelid -b:selfbotuserid <message>", isMainbot);

            const selfbot = userClients.find(c => c.user.id === botUserId);
            if (!selfbot) return sendReply(msg, "❌ user not found with given ID.", isMainbot);

            try {
                const guild = await selfbot.guilds.fetch(serverId);
                const channel = await guild.channels.fetch(channelId);
                await channel.send(message);
                return sendReply(msg, `📤 Message sent to <#${channelId}> via ${selfbot.user.username}`, isMainbot);
            } catch (err) {
                return sendReply(msg, `❌ Failed to send message`, isMainbot);
            }
        }
    }
if (command === "afk") {
  const response = await sendReply(msg, "Alr", isMainbot);
  await addAfkUser(msg.author.id);
  return response;
}

if (command === "follow") {
    const arg = args[0];
    if (arg === "stop") {
      await removeFollowAdmin(msg.author.id);
      return sendReply(msg, "🛑 Stoped following.", isMainbot);
    }

    const count = Math.min(Math.max(parseInt(arg || "5"), 1), 12);
    await setFollowAdmin(msg.author.id, count);
    return sendReply(msg, `✅ Activated following...\nFollowed by up ${count} reactions.`, isMainbot);
  }
    if (command === "name") {
        const botUserId = args[0];
        const newName = args.slice(1).join(" ");

        if (!botUserId || !newName) {
            return sendReply(msg, "❌ Usage: .name <selfbotuserid> <new name>", isMainbot);
        }

        const selfbot = userClients.find(c => c.user.id === botUserId);
        if (!selfbot) return sendReply(msg, "❌ user not found with given ID.", isMainbot);

        function setVariable(msg, selfbot) {
            global.latestCommandMessage = msg; // the command invoker
            global.targetSelfbotClient = selfbot;
        }
        try {
            // await global.latestCommandMessage = msg; // the command invoker
            setVariable(msg, selfbot); // the selfbot being changed
            await selfbot.user.setGlobalName(newName);
            return sendReply(msg, `✅ Name updated for <@${selfbot.user.id}>`, isMainbot);
        } catch (err) {
            console.error(`Failed to set username: ${err.message}`);
            return sendReply(msg, `❌ Failed to update username. Reason: ${err.message}`, isMainbot);
        }
    }


    if (command === "pfp") {
        const botUserId = args[0];

        if (!botUserId) {
            return sendReply(msg, "❌ Usage: `.pfp <selfbotuserid>` (must be used as a reply to an image message)", isMainbot);
        }

        const selfbot = userClients.find(c => c.user.id === botUserId);
        if (!selfbot) return sendReply(msg, "❌ user not found with given ID.", isMainbot);

        // Must be replying to a message
        if (!msg.reference?.messageId) {
            return sendReply(msg, "❌ Please reply to an image message to use this command.", isMainbot);
        }

        try {
            // Fetch the original message being replied to
            const ch = await msg.channel.messages.fetch(msg.reference.messageId);
            const attachment = ch.attachments.find(att => att.contentType?.startsWith('image/'));

            if (!attachment) {
                return sendReply(msg, "❌ Replied message must contain an image.", isMainbot);
            }

            // Set variables for captcha fallback
            global.latestCommandMessage = msg;
            global.targetSelfbotClient = selfbot;

            // Set the avatar
            await selfbot.user.setAvatar(attachment.url);
            return sendReply(msg, `✅ Avatar updated for <@${selfbot.user.id}>`, isMainbot);
        } catch (err) {
            console.error(`Failed to set avatar: ${err.message}`);
            return sendReply(msg, `❌ Failed to update avatar. Reason: ${err.message}`, isMainbot);
        }
    }

   if (command === "ini") {
    const message = args.join(" ");
    if (!message) return sendReply(msg, "❌ Usage: `.ini your message here`", isMainbot);

    for (const selfbot of userClients) {
        try {
            const ch = await selfbot.channels.fetch(msg.channel.id);
            await ch.send(message);
            console.log(`📤 Sent from ${selfbot.user.username}`);
        } catch (err) {
            console.error(`❌ Failed to send from ${selfbot.user.username}: ${err.message}`);
        }

        // ⏳ Wait 3 seconds before next message
        await new Promise(res => setTimeout(res, 3000));
    }

    return sendReply(msg, `✅ DONE.`, isMainbot);
}

    if (command === "joinbr") {
        const serverArg = args.find(a => a.startsWith("-s:"));
        const channelArg = args.find(a => a.startsWith("-c:"));
        const messageArg = args.find(a => a.startsWith("-m:"));

        if (!serverArg || !channelArg || !messageArg) {
            return sendReply(msg, "❌ Usage: `.joinbr -s:serverid -c:channelid -m:messageid`", isMainbot);
        }

        const serverId = serverArg.split(":")[1];
        const channelId = channelArg.split(":")[1];
        const messageId = messageArg.split(":")[1];

        for (const selfbot of userClients) {
            try {
                const guild = await selfbot.guilds.fetch(serverId);
                const channel = await guild.channels.fetch(channelId);
                const message = await channel.messages.fetch(messageId);

                const components = message.components;
                if (!components || components.length === 0) {
                    console.log(`⚠️ No components found in message for ${selfbot.user.username}`);
                    continue;
                }

                let clicked = false;
                for (const row of components) {
                    for (const button of row.components) {
                        const label = (button.label || "").toLowerCase();
                        if (label.includes("join bankrob")) {
                            await message.clickButton(button.customId);
                            console.log(`💰 ${selfbot.user.username} clicked 'JOIN BANKROB'`);
                            clicked = true;
                            break;
                        }
                    }
                    if (clicked) break;
                }

                if (!clicked) {
                    console.log(`❌ 'JOIN BANKROB' button not found for ${selfbot.user.username}`);
                }

            } catch (err) {
                console.error(`❌ Failed for ${selfbot.user.username}: ${err.message}`);
            }
        }

        return sendReply(msg, `✅ JOINED ALL OF US`, isMainbot);
    }

    if (command === "skull") {
        if (args[0] === "stop") {
            skullActive = false;
            return sendReply(msg, "🚩 Skull tracking stopped.", isMainbot);
        }

        if (args[0] === "active") {
            skullActive = true;
            const data = await getAdminData();
            const count = data.approvedmember.length;
            const everyoneStatus = data.everyone ? "✅ Yes" : "❌ No";
            return sendReply(msg, `📁 **Skull Tracking Status:**\n• Tracked Users: \`${count}\`\n• Everyone Enabled: ${everyoneStatus}`, isMainbot);
        }

        if (args[0] === "remove") {
            if (args[1] === "all") {
                const data = await getAdminData();
                data.approvedmember = [];
                await saveAdminData(data);
                return sendReply(msg, "🗑️ All ids removed.", isMainbot);
            }
            const ids = args.slice(1).map(arg => arg.replace(/[^0-9]/g, '')).filter(Boolean);
            if (!ids.length) return msg.reply("❌ Mention users or provide valid IDs to remove.");
            await removeApprovedMembers(ids);
            return sendReply(msg, `🗑️ Removed: ${ids.join(", ")}`, isMainbot);
        }

        if (args[0] === "all") {
            if (args[1] === "stop") {
                await setEveryoneTracking(false);
                return sendReply(msg, "❌ Skull tracking for everyone stopped.", isMainbot);
            }
            await setEveryoneTracking(true);
            return sendReply(msg, "💀 Skull tracking for everyone is now active.", isMainbot);
        }

        if (args[0] === "list") {
            const tracked = (await getAdminData()).approvedmember;
            if (!tracked.length) return msg.reply("📍 No users being tracked.");
            const lines = tracked.map(id => `<@${id}>`);
            return sendReply(msg, "📋 **Skull Tracking List**:\n" + lines.join("\n"), isMainbot);
        }

        const ids = msg.mentions.users.map(u => u.id).concat(args.filter(a => /^\d{17,20}$/.test(a)));
        if (!ids.length) return msg.reply("❌ Mention users or provide valid IDs.");
        await addApprovedMembers(ids);
        return sendReply(msg, `💀 Tracking skulls for: ${ids.map(id => `<@${id}>`).join(", ")}`, isMainbot);
    }

    if (command === "restart") {
        const restartingMsg = await sendReply(msg, "♻️ Restarting server...", isMainbot);
        fs.writeFileSync(RESTART_FILE, JSON.stringify({
            restarting: true,
            channelId: msg.channel.id,
            messageId: restartingMsg.id
        }, null, 2));
        const file = __filename; // full path of current script
        fs.utimesSync(file, new Date(), new Date()); // simulate file change
        process.exit(0);
    }

}
mainBot.on("messageCreate", async (msg) => {
    if (msg.author.bot || !msg.content.startsWith(prefix)) return;
    const data = await getAdminData();
    const isAdmin = data.admins.includes(msg.author.id);
    if (!isAdmin) return;
    try {
        await commands(msg, data, true);
    } catch (err) {
        console.error("Command error:", err.message);
        msg.reply(`❌ Error executing command: `);
    }

});

const sendCaptchaLink = async (msg, url, selfbot = null) => {
    try {
        const adminUser = await mainBot.users.fetch(msg.author.id); // Send to who triggered the command

        let info = ` **✌️ Captcha for Changing!**\nSolve it here: ${url}`;

        if (selfbot) {
            info += `\nFor the bot: <@${selfbot.user.id}>`;
        }
        await adminUser.send(info);
        console.log(`📨 Sent link via DM to ${adminUser.tag}`);
    } catch (err) {
        console.error("❌ Failed to DM CAPTCHA link:", err.message);
    }

};