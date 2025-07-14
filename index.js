require('dotenv').config();
const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    PermissionsBitField,
    Client: BotClient,
      ActionRowBuilder,
      StringSelectMenuBuilder,
      ButtonBuilder,
      ButtonStyle,
      ChannelType,
      PermissionFlagsBits,
      MessageFlags
} = require('discord.js');
const SelfbotClient = require('discord.js-selfbot-v13');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({
    default: fetch
}) => fetch(...args));

const DANK_ID = '270904126974590976';
const allowedChannelForPirates = '1394032318871638018'; // Channel where pirates can use commands
let testInitiatorId = null;
let cachedMutuals = [];
const pageCache = new Map(); // maps userId to { pages: [...], pageIndex }
const BOT_OUTPUT_CHANNEL = '1386432193617989735'; // 👈 Set this to your bot's control channel
const express = require('express');
const app = express();
const port = process.env.PORT || 4000;
const port2 = process.env.PORT2 || 3000;


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
app.listen(port2, () => {
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
mongoose.connect(process.env.MONGO_URI, {
  dbName: "test",
  serverSelectionTimeoutMS: 30000, // Wait up to 30 seconds for initial server response
  socketTimeoutMS: 45000,           // Close sockets after 45 seconds of inactivity
  connectTimeoutMS: 30000 // <== Add this
})
.then(() => console.log("✅ Connected to MongoDB Atlas"))
.catch(err => console.error("❌ MongoDB connection error:", err));

mongoose.connection.on('connected', () => {
  console.log("✅ Mongoose connected");
});
mongoose.connection.on('error', err => {
  console.error("❌ Mongoose error:", err);
});
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

const PirateSchema = new mongoose.Schema({
  pirates: [{
    userid: String,
    allowedCommands: [String]
  }]
});
const PirateData = mongoose.model("PirateData", PirateSchema);

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

const ensurePirateData = async () => {
  const exists = await PirateData.findOne();
  if (!exists) await PirateData.create({ pirates: [] });
};
ensurePirateData();

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
//pirate data functions
const getPirateData = async () => await PirateData.findOne();
const savePirateData = async (data) => await data.save();

const addPirate = async (userid) => {
  const data = await getPirateData();
  if (!data.pirates.some(p => p.userid === userid)) {
    data.pirates.push({ userid, allowedCommands: [] });
    await savePirateData(data);
  }
};

const removePirate = async (userid) => {
  const data = await getPirateData();
  data.pirates = data.pirates.filter(p => p.userid !== userid);
  await savePirateData(data);
};

const enablePirateCommand = async (userid, command) => {
  const data = await getPirateData();
  const pirate = data.pirates.find(p => p.userid === userid);
  if (pirate && !pirate.allowedCommands.includes(command)) {
    pirate.allowedCommands.push(command);
    await savePirateData(data);
  }
};

const disablePirateCommand = async (userid, command) => {
  const data = await getPirateData();
  const pirate = data.pirates.find(p => p.userid === userid);
  if (pirate) {
    pirate.allowedCommands = pirate.allowedCommands.filter(c => c !== command);
    await savePirateData(data);
  }
};

const isPirateAllowed = async (userid, command) => {
  const data = await getPirateData();
  const pirate = data.pirates.find(p => p.userid === userid);
  return !!(pirate && pirate.allowedCommands.includes(command));
};


console.log("🔍 Loading tokens from .env...\n");

const scannerClient = new SelfbotClient.Client({
    checkUpdate: false
});
scannerClient.login(process.env.SCANNER_TOKEN)
  .then(() => console.log(`🟡 Scanner Selfbot (${scannerClient.user.username}) is ready.`))
  .catch(err => console.error("❌ Scanner selfbot login failed:", err));

const { setScannerClient, runFullScan, cancelScan } = require('./roblister');
 // inject client

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
    makeCache: () => new Map() // ❌ disables all caching
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

mainBot.login(process.env.BOT_TOKEN)
 .then(() => console.log(`🤖 Logged in as ${mainBot.user.tag}`))
  .catch(err => console.error("❌ Main bot login failed:", err));

setScannerClient(scannerClient, mainBot);
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
            makeCache: () => createLimitedCache(150, '270904126974590976'),
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
//join bankrob


if (scannerClient) {
  scannerClient.on("messageCreate", async (msg) => {
    if (msg.author.bot || msg.content.trim().toLowerCase() !== 'join') return;

    console.log("Join bankrob command received");

    if (!msg.reference?.messageId) return; // Not a reply

    const data = await getAdminData();
    const isAdmin = data.admins.includes(msg.author.id);
    const isPiratePermitted = await isPirateAllowed(msg.author.id, 'join');

 if (
  !isAdmin &&
  (
    msg.channel.id !== allowedChannelForPirates ||
    !isPiratePermitted
  )
) return;

    try {
      const channel = await msg.channel.fetch();
      const repliedMsg = await channel.messages.fetch(msg.reference.messageId);
      //console.dir(repliedMsg.toJSON(),{ depth: null }); // Log the replied message for debugging

      // ✅ Check: Message from Dank Memer + is slash command
      if (
        repliedMsg.author.id !== DANK_ID ||
        repliedMsg.type !== 'APPLICATION_COMMAND'
      ) return;

      const components = repliedMsg.components;
      if (!components || components.length === 0) return;
      const joinBtn = repliedMsg.components?.flatMap(c => c.components)
      .find(b => b.label?.toLowerCase().includes("join bankrob") && !b.disabled);
      //console.log(joinBtn);
      if (joinBtn.disabled) return;

 
 for (const selfbot of userClients) {
            try {
             //   const guild = await selfbot.guilds.fetch(repliedMsg.guildId);
                const channel = await selfbot.channels.fetch(repliedMsg.channelId);
                const message = await channel.messages.fetch(repliedMsg.id);
                await message.clickButton(joinBtn.customId);

            } catch (err) {
                console.error(`❌ Failed for ${selfbot.user.username}: ${err.message}`);
            }
        }
// ✅ Send joined message from main bot
try {
  const outputChannel = await mainBot.channels.fetch("1386432193617989735").catch(() => null);
  if (outputChannel?.isTextBased?.()) {
    await outputChannel.send("✅ JOINED ALL OF THEM");
  }
} catch (e) {
  console.error("❌ Failed to send output message:", e.message);
}
    } catch (err) {
      console.error('❌ Error fetching replied message:', err.message);
    }
  });
  
}




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

if (command === "depo") {
    const channelId = msg.channel.id;
    const dankId = '270904126974590976';

    for (const selfbot of userClients) {
        try {
            const ch = await selfbot.channels.fetch(channelId);

            // Step 1: Send pls bal
            await ch.send('pls bal');
            console.log(`📤 Sent: pls bal via ${selfbot.user.username}`);

            // Step 2: Wait for Dank Memer embed reply with balance
            const replyMsg = await ch.awaitMessages({
                max: 1,
                time: 10000,
                filter: m => m.author.id === dankId && m.embeds.length > 0,
            });

            const botMsg = replyMsg.first();
            if (!botMsg) {
                console.log(`⚠️ No embed reply from Dank Memer for ${selfbot.user.username}`);
                continue;
            }

            const desc = botMsg.embeds[0].description || '';
            const coinMatch = desc.match(/<:Coin:\d+>\s*([\d,]+)/);
            if (!coinMatch) {
                console.log(`⚠️ Coin value not found for ${selfbot.user.username}`);
                continue;
            }

            const coinStr = coinMatch[1].replace(/,/g, '');
            const coinValue = parseInt(coinStr, 10);
            const reservedAmount = Math.floor(coinValue * 0.01) + 100_000;

            console.log(`💰 ${selfbot.user.username} Balance: ${coinValue.toLocaleString()}`);

            if (coinValue > 500_000 && coinValue > reservedAmount) {
                const maxOffer = coinValue - reservedAmount;
                if (maxOffer < 1_000) {
                    console.log(`⚠️ ${selfbot.user.username} has insufficient extra to offer.`);
                    continue;
                }

                const offerPrice = formatNumberForDank(maxOffer);
                await ch.send(`pls market post for_coins buy 1 Apple ${offerPrice} 1 false true`);
                console.log(`📦 ${selfbot.user.username} posted Apple at ${offerPrice}`);

                const confirmMsg = await ch.awaitMessages({
                    max: 1,
                    time: 15000,
                    filter: m =>
                        m.author.id === dankId &&
                        m.components?.some(row =>
                            row.components.some(c => c.customId?.endsWith(':confirm'))
                        ),
                });

                const msgWithBtn = confirmMsg.first();
                if (!msgWithBtn) {
                    console.log(`❌ No Confirm button for ${selfbot.user.username}`);
                    continue;
                }

                const confirmBtn = msgWithBtn.components
                    .flatMap(row => row.components)
                    .find(c => c.customId?.endsWith(':confirm'));

                if (confirmBtn) {
                    try {
                        await msgWithBtn.clickButton(confirmBtn.customId);
                        console.log(`✅ Confirm clicked for ${selfbot.user.username}`);
                    } catch (err) {
                        console.error(`❌ Confirm click failed for ${selfbot.user.username}:`, err.message);
                    }
                } else {
                    console.log(`❌ Confirm button not found for ${selfbot.user.username}`);
                }

            } else {
                console.log(`❌ ${selfbot.user.username} has low balance or under reserve limit.`);
            }
        } catch (err) {
            console.error(`❌ Error in .depo for ${selfbot.user.username}:`, err.message);
        }

        // Wait between bots
        await new Promise(res => setTimeout(res, 3000));
    }

    return sendReply(msg, `✅ Ready for transfer`, isMainbot);
}

if (command === "pirate") {
 const [_, action, userId, commandName] = msg.content.trim().split(/\s+/);
//if (!userId) return msg.reply('❌ Provide user ID');

  if (action === 'add') {
    await addPirate(userId);
    msg.reply(`✅ Added pirate <@${userId}>`);
  } else if (action === 'remove') {
    await removePirate(userId);
    msg.reply(`🗑️ Removed pirate <@${userId}>`);
  } else if (action === 'enable') {
    if (!commandName) return msg.reply('❌ Provide command to enable');
    await enablePirateCommand(userId, commandName);
    msg.reply(`✅ Enabled \`${commandName}\` for pirate <@${userId}>`);
  } else if (action === 'disable') {
    if (!commandName) return msg.reply('❌ Provide command to disable');
    await disablePirateCommand(userId, commandName);
    msg.reply(`🚫 Disabled \`${commandName}\` for pirate <@${userId}>`);
  } else if (action === 'list') {

    const data = await getPirateData();
  if (!data || data.pirates.length === 0) {
    return msg.reply('🧭 No pirates found.');
  }

  const lines = await Promise.all(data.pirates.map(async pirate => {
    const userTag = await mainBot.users.fetch(pirate.userid)
      .then(user => `${user.username}#${user.discriminator}`)
      .catch(() => pirate.userid); // fallback to ID if user not cached or fetch fails

    const commands = pirate.allowedCommands.length > 0
      ? pirate.allowedCommands.join(', ')
      : '🚫 No commands enabled';

    return `🦜 **${userTag}**\n   └─ ${commands}`;
  }));

  const chunked = splitMessage(lines.join('\n'), 2000);
  for (const chunk of chunked) msg.reply(chunk);

  } else {
    msg.reply('❌ Invalid pirate action. Use `add`, `remove`, `enable`, or `disable`.');
  }




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

    if (command === "ma") {
    const botArg = args.find(a => a.startsWith("-b:"));
    const marketArg = args.find(a => a.startsWith("-c:"));

    if (!botArg || !marketArg) {
        return sendReply(msg, "❌ Usage: `.ma -b:<botid> -c:<marketid>`", isMainbot);
    }

    const botUserId = botArg.split(":")[1];
    const marketId = marketArg.split(":")[1];

    const selfbot = userClients.find(c => c.user.id === botUserId);
    if (!selfbot) return sendReply(msg, "❌ Selfbot with given ID not found.", isMainbot);

    try {
        const ch = await selfbot.channels.fetch(msg.channel.id);
        const sentMsg = await ch.send(`pls market accept ${marketId}`);
        console.log(`📤 Sent: pls market accept ${marketId}`);

        // Wait for Dank Memer's reply
       const replyMsg = await ch.awaitMessages({
    max: 1,
    time: 10000,
    filter: m => m.author.id === '270904126974590976' && m.reference?.messageId === sentMsg.id
});

const msgFromBot = replyMsg.first();
if (!msgFromBot) return sendReply(msg, "⚠️ No reply from Dank Memer after market accept.", isMainbot);

// ⏳ Wait 2s then refetch to get full button component
await new Promise(res => setTimeout(res, 2000));
const fullMsg = await ch.messages.fetch(msgFromBot.id);

console.log(`🔍 Fetched full message with components: ${fullMsg}`);

// 🔍 Try to find a "Confirm" button
const confirmBtn = fullMsg.components
    .flatMap(row => row.components)
    .find(btn => (btn.label || "").toLowerCase().includes("confirm") && !btn.disabled);

if (!confirmBtn) return sendReply(msg, "⚠️ Confirm button not found or disabled.", isMainbot);

// ✅ Click the button
await fullMsg.clickButton(confirmBtn.customId);

  
        console.log(`✅ Confirm button clicked via ${selfbot.user.username}`);

        return sendReply(msg, `🟢 Market item \`${marketId}\` accepted and confirmed via ${selfbot.user.username}`, isMainbot);

    } catch (err) {
        console.error("❌ Error in .ma command:", err.message);
        return sendReply(msg, `❌ Failed to accept market item.\nReason: ${err.message}`, isMainbot);
    }
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

    const commandName = msg.content.trim().split(/\s+/)[0]; // e.g. `.command`
    const data = await getAdminData();

    const isAdmin = data.admins.includes(msg.author.id);
    const isPiratePermitted = await isPirateAllowed(msg.author.id, commandName);

 if (
  !isAdmin &&
  (
    msg.channel.id !== allowedChannelForPirates ||
    !isPiratePermitted
  )
) return;

    try {
        await commands(msg, data, true);
    } catch (err) {
        console.error("Command error:", err.message);
        msg.reply(`❌ Error executing command.`);
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
function formatNumberForDank(num) {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

 // update with actual path

mainBot.on('interactionCreate', async (interaction) => {
  if (interaction.user.id !== testInitiatorId) {
    return interaction.reply({
      content: "Buddy, You are not him.",
      ephemeral: true
    });
  }

  // 1. SERVER SELECTED
if (
  interaction.isStringSelectMenu() &&
  interaction.customId.startsWith('select_mutual_guild_page_')
) {
  const selectedGuildId = interaction.values[0];
  console.log(selectedGuildId)
  const state = pageCache.get(interaction.user.id);
  const allMutuals = state?.pages.flat() || [];

  const mutual = allMutuals.find(g => g.id === selectedGuildId);
  if (!mutual) {
    return interaction.reply({
      content: "❌ Server not found in cache.",
      ephemeral: true
    });
  }

  try {
    const guild = scannerClient.guilds.cache.get(selectedGuildId);
    if (!guild) throw new Error('Guild not found in selfbot cache.');

    const dankMember = await guild.members.fetch(DANK_ID);

    const textChannels = Array.from(guild.channels.cache.values())
      .filter(channel =>
        channel.type === `GUILD_TEXT` &&
        channel.viewable &&
        (
          channel.permissionsFor(dankMember)?.has(PermissionFlagsBits.UseApplicationCommands) ||
          channel.permissionsFor(dankMember)?.has(PermissionFlagsBits.SendMessages)
        )
      )
      .map(channel => ({
        label: channel.name.slice(0, 90),
        value: channel.id
      }));

    if (textChannels.length === 0) {
      return interaction.reply({
        content: "❌ No usable channels found.",
        ephemeral: true
      });
    }

    const channelRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`select_any_channel:${selectedGuildId}`)
        .setPlaceholder('Select a channel')
        .addOptions(textChannels.slice(0, 25)) // limit to 25
    );

    await interaction.update({
      content: `✅ Selected server: **${mutual.name}**\n📡 Now choose a channel:`,
      components: [channelRow]
    });

  } catch (err) {
    console.error("❌ Error reading channels:", err.message);
    return interaction.reply({
      content: "❌ Failed to read channels.",
      ephemeral: true
    });
  }
}


  // 2. CHANNEL SELECTED
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('select_any_channel')) {
    const selectedChannelId = interaction.values[0];
    const selectedGuildId = interaction.customId.split(':')[1];

    interaction.client._scanData ??= {};
    interaction.client._scanData[interaction.user.id] = { guildId: selectedGuildId, channelId: selectedChannelId };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('scan_bank')
        .setLabel('🏦 Bank')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('scan_pocket')
        .setLabel('👛 Pocket')
        .setStyle(ButtonStyle.Primary)
    );

    await interaction.update({
      content: `✅ Channel: <#${selectedChannelId}>\n🔘 Now select a leaderboard type:`,
      components: [row]
    });
  }

  // 3. SELECT LEADERBOARD TYPE
  if (interaction.isButton() && (interaction.customId === 'scan_bank' || interaction.customId === 'scan_pocket')) {
    try {
      const userData = interaction.client._scanData?.[interaction.user.id];
      if (!userData) {
        return interaction.reply({ content: '❌ Missing selection context.', ephemeral: true });
      }

      const { guildId, channelId } = userData;
      const li = interaction.customId === 'scan_bank' ? 'Bank' : 'Pocket';
      interaction.client._scanData[interaction.user.id].li = li;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('threshold_2m').setLabel('2m').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('threshold_10m').setLabel('10m').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('threshold_30m').setLabel('30m').setStyle(ButtonStyle.Secondary)
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('threshold_50m').setLabel('50m').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('threshold_75m').setLabel('75m').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('threshold_100m').setLabel('100m').setStyle(ButtonStyle.Secondary)
      );

      await interaction.update({
        content: `💰 Select the minimum coin threshold to rob:`,
        components: [row, row2]
      });

    } catch (err) {
      console.error("❌ Error in leaderboard button:", err);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ Failed to process leaderboard selection.', ephemeral: true });
      }
    }
  }

  // 4. THRESHOLD SELECTED
  if (interaction.isButton() && interaction.customId.startsWith('threshold_')) {
    try {
      const userData = interaction.client._scanData?.[interaction.user.id];
      if (!userData || !userData.li) {
        return interaction.reply({ content: '❌ Missing context for scanning.', ephemeral: true });
      }

      const { guildId, channelId, li } = userData;
      const thresholdText = interaction.customId.split('_')[1];
      const threshold = parseInt(thresholdText.replace('m', '')) * 1_000_000;

      const cancelRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('cancel_scan')
          .setLabel('❌ Cancel Scan')
          .setStyle(ButtonStyle.Danger)
      );

      const statusMsg = await interaction.update({
        content: `📊 Starting **${li}** leaderboard scan with rob filter: **≥ ${thresholdText}**`,
        components: [cancelRow]
      }).then(() => interaction.fetchReply());

      runFullScan(guildId, channelId, li, 1, threshold, statusMsg, interaction.user.id);


    } catch (err) {
      console.error("❌ Error in threshold selection:", err);
      if (!interaction.replied) {
        await interaction.reply({ content: '❌ Failed to start scan.', ephemeral: true });
      }
    }
  }

  // 5. CANCEL SCAN
if (interaction.isButton() && interaction.customId === 'cancel_scan') {
  const userData = interaction.client._scanData?.[interaction.user.id];
  if (!userData || !userData.guildId || !userData.channelId) {
    return interaction.reply({
      content: '⚠️ Cannot cancel — no active scan context found.',
      ephemeral: true
    });
  }

  const { guildId, channelId } = userData;

  const cancelled = cancelScan(guildId, channelId);
  if (cancelled) {
    await interaction.update({
      content: '🛑 Cancelling scan...',
      components: []
    });
  } else {
    await interaction.update({
      content: '⚠️ No active scan was found for this channel.',
      components: []
    });
  }
}

});



mainBot.on('messageCreate', async (msg) => {
    
     if (msg.author.bot || !msg.content.startsWith(prefix)) return;

    const commandName = msg.content.trim().split(/\s+/)[0]; // e.g. `.command`
    const data = await getAdminData();

    const isAdmin = data.admins.includes(msg.author.id);
    const isPiratePermitted = await isPirateAllowed(msg.author.id, commandName);

   // if (!isAdmin && !isPiratePermitted) return;
    if (
  !isAdmin &&
  (
    msg.channel.id !== allowedChannelForPirates ||
    !isPiratePermitted
  )
) return;

  const args = msg.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

if (command === 'scan') {
  const mutuals = [];
  testInitiatorId = msg.author.id;

  for (const guild of scannerClient.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch(DANK_ID);
      if (member) mutuals.push({ name: guild.name, id: guild.id });
    } catch {}
  }

  if (mutuals.length === 0) {
    return msg.reply("❌ No mutual servers with Dank Memer.");
  }

  // Split into pages of 25
  const pages = [];
  for (let i = 0; i < mutuals.length; i += 25) {
    pages.push(mutuals.slice(i, i + 25));
  }

  pageCache.set(msg.author.id, { pages, pageIndex: 0 });

  const createMenuForPage = (pageIndex) => {
    const options = pages[pageIndex].map(guild => ({
      label: guild.name.length > 30 ? guild.name.slice(0, 30) + "..." : guild.name,
      value: guild.id
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_mutual_guild_page_${pageIndex}`)
      .setPlaceholder(`Page ${pageIndex + 1} of ${pages.length}`)
      .addOptions(options);

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('prev_page')
        .setLabel('⬅ Prev')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === 0),
      new ButtonBuilder()
        .setCustomId('next_page')
        .setLabel('Next ➡')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(pageIndex === pages.length - 1)
    );

    return {
      components: [new ActionRowBuilder().addComponents(selectMenu), buttons]
    };
  };

  const page = createMenuForPage(0);

  await msg.channel.send({
    content: '📜 **Select a mutual Dank Memer server:**',
    components: page.components
  });
}

});

mainBot.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.user.id !== testInitiatorId) {
    return interaction.reply({
      content: "Buddy, You are not him.",
      ephemeral: true
    })}

  const { user } = interaction;
  const state = pageCache.get(user.id);
  if (!state) return;

  if (interaction.customId === "next_page") {
    state.pageIndex++;
  } else if (interaction.customId === "prev_page") {
    state.pageIndex--;
  } else return;

  const { pageIndex, pages } = state;

  const options = pages[pageIndex].map(guild => ({
    label: guild.name.length > 40 ? guild.name.slice(0, 40) + "..." : guild.name,
    value: guild.id
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_mutual_guild_page_${pageIndex}`)
    .setPlaceholder(`Page ${pageIndex + 1} of ${pages.length}`)
    .addOptions(options);

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev_page')
      .setLabel('⬅ Prev')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('next_page')
      .setLabel('Next ➡')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === pages.length - 1)
  );

  await interaction.update({
    components: [new ActionRowBuilder().addComponents(selectMenu), buttons]
  });
});

setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Memory usage: ${Math.round(used * 100) / 100} MB`);
}, 60000);

setInterval(() => {
  mainBot.guilds.cache.forEach(guild => {
    guild.channels.cache.clear();
    guild.members.cache.clear();
  });
  mainBot.users.cache.clear();
 // console.log("🧹 Cleared Discord.js caches");
}, 10 * 60 * 1000); // every 10 minutes


function createLimitedCache(limit = 100, dankId = '270904126974590976') {
  const coll = new Collection();
  const originalSet = coll.set;

  coll.set = function (key, value) {
    // If value is a message and from Dank Memer, keep always
    const isDankMemerMsg = value?.author?.id === dankId;

    if (coll.size >= limit && !coll.has(key) && !isDankMemerMsg) {
      // Prefer removing first non-Dank item
      const firstNonDankKey = coll.findKey(v => v?.author?.id !== dankId);
      if (firstNonDankKey !== undefined) {
        coll.delete(firstNonDankKey);
      } else {
        // fallback if all entries are Dank Memer
        coll.delete(coll.firstKey());
      }
    }

    return originalSet.call(this, key, value);
  };

  return coll;
}

function splitMessage(text, maxLength = 2000) {
  const chunks = [];
  let current = '';

  for (const line of text.split('\n')) {
    if ((current + '\n' + line).length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

