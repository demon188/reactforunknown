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
   // console.log('✅ Message JSON:\n', JSON.stringify(fetchedMsg, null, 2));
    const embed = fetchedMsg.embeds?.[0];
const footerText = embed?.footer?.text || '';
const totalPagesMatch = footerText.match(/Page\s\d+\s+of\s+(\d+)/i);
const totalPages = totalPagesMatch ? parseInt(totalPagesMatch[1]) : 1;

console.log("📄 Total pages:", totalPages);
    
    await msg.reply('✅ Message fetched. Check your console.');
  } catch (err) {
    console.error('❌ Failed to fetch message:', err);
    await msg.reply('❌ Error fetching message.');
  }
});

client.login(process.env.SCANNER_TOKEN);
