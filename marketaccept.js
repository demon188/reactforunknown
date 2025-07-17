const DANK_ID = '270904126974590976';
const guildId = '1102185029926391838';
const channelId = '1390416190031265844';
const calimChannelId = '1390416190031265844';

/**
 * Accepts a Dank Memer market offer using a selfbot by sending a regular message.
 * @param {Client} botClient - The discord.js-selfbot-v13 client.
 * @param {string} marketId - The market ID to accept.
 */
async function acceptMarketOffer(botClient, scannerClinet, marketId, interaction, userId, mainbot) {
  const guild = botClient.guilds.cache.get(guildId);
  const scanGuild = scannerClinet.guilds.cache.get(guildId);
  if (!scanGuild) throw new Error('Scanner guild not found');
  const scannerChannel = scanGuild.channels.cache.get(channelId);
  if (!scannerChannel) throw new Error('Scanner channel not found');
  if (!guild) throw new Error('Guild not found');

  const user = await mainbot.users.fetch(userId).catch(() => null);
  const mention = user ? `${user.username}#${user.discriminator}` : `<@${userId}>`;


  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error('Channel not found');

  // Step 1: Send "pls market accept <marketId>" as normal message
  const sentMsg = await channel.send(`pls market accept ${marketId}`);

  // Step 2: Listen for Dank Memer's reply to that message
  let replyMsg;
  try {
    const collected = await scannerChannel.awaitMessages({
      filter: msg =>
        msg.author.id === DANK_ID &&
        msg.reference?.messageId === sentMsg.id, // reply to our message
      max: 1,
      time: 10000,
      errors: ['time']
    });
    replyMsg = collected.first();
  } catch {
    await interaction.editReply({
        content: `❌ Try again later.`
      });
    throw new Error('❌ No reply from Dank Memer (timeout or not a reply)');
  }

  //console.dir(replyMsg.toJSON(), {depth : null})
  // Step 3: Check if reply has buttons
  
  const componentWrapper = replyMsg.components?.[0];
if (!componentWrapper || componentWrapper.type !== `CONTAINER`) {
  throw new Error('❌ Unexpected component structure in Dank Memer reply');
}
 // Step 3: Find action row (type: 1)
const actionRow = componentWrapper.components.find(c => 
  c.type === `ACTION_ROW`);

// Step 4: If no action row, maybe invalid market ID
if (!actionRow) {
  const msgText = componentWrapper.components
    .filter(c => c.type === `TEXT_DISPLAY`)
    .map(c => c.content)
    .join('\n');

  if (msgText.includes('There is no offer with this id')) {
      await interaction.editReply({
        content: `❌ Invalid market ID — no offer found.`
      });
    console.log('❌ Invalid market ID — no offer found.');
    return;
  }

  console.log('⚠️ No action row found — maybe already accepted or malformed.');
  return;
}

//console.dir(actionRow.components, {depth: null});
// Step 5: Click confirm button
const confirmBtn = actionRow.components.find(
  btn => btn.label?.toLowerCase() === 'confirm'
);

if (!confirmBtn) {
  await interaction.editReply({
        content: `Try again with a valid market ID`,
      });
  return console.log(`no confirm button found with customId`);
}
//console.log(`✅ Found confirm button: ${confirmBtn.customId}`);
//const finalguild = botClient.guilds.cache.get(guildId);
const finalchannel = await botClient.channels.fetch(channelId);
const finalmessage = await finalchannel.messages.fetch(replyMsg.id);

await finalmessage.clickButton(confirmBtn.customId)
await interaction.editReply({
        content: `✅ Market offer accepted successfully!`
      });
      
console.log('✅ Market offer accepted successfully! by', mention);
}
module.exports = { acceptMarketOffer };
