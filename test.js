const { Client } = require('discord.js-selfbot-v13');
require('dotenv').config();

const client = new Client();

client.on('ready', () => {
  console.log(`🟢 Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (msg) => {
  if (msg.author.id !== client.user.id) return; // Only respond to your own messages
  if (!msg.content.startsWith('.msg')) return;

  const args = msg.content.trim().split(/\s+/);
  const messageId = args[1];

  if (!messageId) {
    return msg.reply('❌ Please provide a message ID.');
  }

  try {
    const fetchedMsg = await msg.channel.messages.fetch(messageId);
    const embed = fetchedMsg.embeds?.[0];

if (embed?.description?.includes(`They're trying to break`)) {
  const descMatch = embed.description?.match(/\*\*(.*?)\*\*/);
  const robTargerName = descMatch?.[1];
  
}
console.log('Target:', robTargerName);
   // console.log('✅ Message JSON:\n', JSON.stringify(fetchedMsg, null, 2));
    await msg.reply('✅ Message fetched. Check your console.');
  } catch (err) {
    console.error('❌ Failed to fetch message:', err);
    await msg.reply('❌ Error fetching message.');
  }
});

client.login(process.env.SCANNER_TOKEN);
