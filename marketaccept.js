const DANK_ID = '270904126974590976';
const guildId = '1102185029926391838';
const channelId = '1390416190031265844';
const calimChannelId = '1394943689239036005';

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
  let payAmount = 0;


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
const confirmTextComponent = replyMsg.components[0].components.find(c =>
  c.type === `TEXT_DISPLAY` && c.content?.includes('For Your:')
);
payAmount = confirmTextComponent?.content.match(/- (⏣ [\d,]+)/)?.[1] || null;

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

const buttonclick = await finalmessage.clickButton(confirmBtn.customId);
if (
  buttonclick?.components?.[0]?.components?.[0]?.content?.includes('Successfully accepted') ||
  buttonclick?.embeds?.some(embed =>
    embed?.description?.includes('Action Confirmed') ||
    embed?.title?.includes('Action Confirmed')
  )
){
  await interaction.editReply({
        content: `✅ Money transferred successfully!`
      });
      // ✅ Send message to calimChannelId via mainbot
  const claimChannel = await mainbot.channels.fetch(calimChannelId).catch(() => null);
  if (claimChannel && claimChannel.isTextBased?.()) {
    const now = Math.floor(Date.now() / 1000); // UNIX timestamp in seconds

await claimChannel.send({
  embeds: [
    {
      color: 0x00ff00, // Bright green
      title: '🏴‍☠️ Pirate Payout Delivered!',
      description: `✨ <@${userId}> just received a juicy payout from robbery tresures!`,
      fields: [
        {
          name: '💰 Amount Received',
          value: `**${payAmount || '???'}**`,
          inline: true
        },
        {
          name: '🕒 Time',
          value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
          inline: true
        }
      ],
      footer: {
        text: '💸 Loot shared • We are Pirates'
      },
      timestamp: new Date()
    }
  ]
});

  }

  // ✅ DM the user if cached or fetchable
   console.log('✅ payAmount:', payAmount, `Received by:`, mention);
}else {
  console.log('❌ Failed to accept offer, maybe already accepted or invalid market ID');
  await interaction.editReply({
        content: `I cant get the response from Dank Memer, maybe already accepted`,
      });
  return;
}
  return {
    success: true,
    payAmount,
    mention
  };


}
module.exports = { acceptMarketOffer };
