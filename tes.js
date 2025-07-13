const { Client } = require('discord.js-selfbot-v13');
require('dotenv').config();
const delay = ms => new Promise(res => setTimeout(res, ms));

const TOTAL_BOTS = 12;
const OWNER_ID = '785501672998567956';
const COMMAND = '.levelhunt';
const dankMemerId = '270904126974590976';
const test = true; // Set to false for production

const COMMAND_SEQUENCE = [
    { cmd: 'pls highlow', cooldown: 20000, button: true },
    { cmd: 'pls hunt', cooldown: 20000, button: false },
    { cmd: 'pls beg', cooldown: 40000, button: false },
    { cmd: 'pls dig', cooldown: 20000, button: false },
];

const clients = [];

for (let i = 1; i <= TOTAL_BOTS; i++) {
    const token = process.env[`USER_TOKEN_${i}`];
    if (!token) continue;

    const client = new Client();

    client.on('ready', () => {
        console.log(`🟢 Logged in: ${client.user.username}`);
    });

    clients.push({
        client,
        token,
        commandIndex: 0,
        lastSentAt: 0,
        lastCmdTimes: {}  // Track cooldowns per command
    });
}

(async () => {
    for (const { client, token } of clients) {
        await client.login(token);
    }

    const mainListener = clients[0].client;

    mainListener.on('messageCreate', async (msg) => {
        if (msg.author.id !== OWNER_ID || !msg.content.startsWith(COMMAND)) return;

        console.log(`📩 .levelhunt triggered by ${msg.author.username}`);
        const channelId = msg.channel.id;

        for (const botObj of clients) {
            handleBotLoop(botObj, channelId);
        }
    });
})();

async function handleBotLoop(botObj, channelId) {
    const { client } = botObj;

    while (true) {
        const now = Date.now();

        const commandInfo = COMMAND_SEQUENCE[botObj.commandIndex];
        const { cmd, cooldown, button } = commandInfo;

        const timeSinceLastMsg = now - botObj.lastSentAt;
        const timeSinceThisCmd = now - (botObj.lastCmdTimes[cmd] || 0);

        if (timeSinceLastMsg >= 20000 && timeSinceThisCmd >= cooldown) {
            try {
                const channel = await client.channels.fetch(channelId);
                const sentMsg = await channel.send(cmd);
                console.log(`📤 Sent: "${cmd}" from ${client.user.username}`);

                botObj.lastSentAt = Date.now();
                botObj.lastCmdTimes[cmd] = Date.now();

                if (button) {
                    const collected = await channel.awaitMessages({
                        max: 1,
                        time: 10000,
                        errors: ['time'],
                        filter: m => m.author.id === dankMemerId && m.reference?.messageId === sentMsg.id
                    });

                    const reply = collected.first();
                    if (reply && reply.components?.length) {
                        const buttons = reply.components.flatMap(row => row.components);
                        const randomBtn = buttons[Math.floor(Math.random() * buttons.length)];
                        if (randomBtn) {
                            await reply.clickButton(randomBtn.customId);
                            console.log(`✅ ${client.user.username} clicked: ${randomBtn.label}`);
                        }
                    } else {
                        console.log(`⚠️ No valid buttons for ${client.user.username}`);
                    }
                }
            } catch (err) {
                console.log(`❌ ${client.user.username} error on "${cmd}": ${err.message}`);
            }

            // Advance to next command
            botObj.commandIndex = (botObj.commandIndex + 1) % COMMAND_SEQUENCE.length;
        }

        await delay(500); // Global check interval
    }
}
