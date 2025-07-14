const { Client } = require('discord.js-selfbot-v13');
require('dotenv').config();

const DANK_ID = '270904126974590976';
const OWNER_ID = '785501672998567956';

const client = new Client();

client.on('ready', () => {
    console.log(`🟢 Logged in as ${client.user.username}`);
});

client.on('messageCreate', async (msg) => {
    if (msg.author.id !== OWNER_ID || !msg.content.startsWith('.accept')) return;

    const args = msg.content.trim().split(/\s+/);
    const marketId = args[1];
    if (!marketId || marketId.length < 3) {
        return msg.channel.send('❌ Invalid or missing market ID.');
    }

    try {
        const sentMsg = await msg.channel.sendSlash(DANK_ID, 'market accept', marketId);

        let finalMsg = sentMsg;
        if (sentMsg.flags?.has?.('LOADING')) {
            finalMsg = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject('❌ Timeout waiting for slash response'), 15000);
                const listener = (oldMsg, newMsg) => {
                    if (oldMsg.id === sentMsg.id && newMsg.author.id === DANK_ID) {
                        clearTimeout(timeout);
                        client.off('messageUpdate', listener);
                        resolve(newMsg);
                    }
                };
                client.on('messageUpdate', listener);
            });
        }

        const container = finalMsg.components?.[0];
        if (!container || container.type !== 'CONTAINER') return;

        const actionRow = container.data.components?.find(c => c.type === 1);
        if (!actionRow) return;

        const confirmBtn = actionRow.components?.find(btn =>
            btn.label?.toLowerCase() === 'confirm' || btn.custom_id?.endsWith(':confirm')
        );
        if (!confirmBtn) return;

        await finalMsg.clickButton(confirmBtn.custom_id);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
});

client.login(process.env.USER_TOKEN_1);
