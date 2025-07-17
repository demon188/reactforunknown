// Required dependencies
const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const DANK_ID = '270904126974590976';

const botIds = new Set([
    '1386079772521533451', '1386074841320526050', '1386084166889635880',
    '1386083090153345125', '1386093184177668150', '1386094110498361444',
    '1386086622117892267', '1386077382406045816', '1386090476477743254',
    '1386078633134915685', '1386071595482878082', '1386095515170770954'
]);

async function handleClaimCommand(mainBotMsg, userId, mainBot, scannerClient, userClients) {
    const mainBotchannel = mainBotMsg.channel;
    const dataguildID = '1102185029926391838';
    const datachannelId = '1390416190031265844';

    const guild = scannerClient.guilds.cache.get(dataguildID);
    if (!guild) return console.log('❌ Guild not found.');

    const channel = guild.channels.cache.get(datachannelId);
    if (!channel) return console.log('❌ Channel not found.');

   // await channel.send('pls lb stats p');

    const dankFilter = m => m.author.id === DANK_ID && m.embeds?.length > 0;
  let msg;
for (let attempt = 1; attempt <= 3; attempt++) {
    await channel.send('pls lb stats p');
    try {
        msg = await channel.awaitMessages({ filter: dankFilter, max: 1, time: 10000, errors: ['time'] }).then(col => col.first());
        if (msg) break;
    } catch {
        if (attempt === 3) {
            return console.log('❌ Failed to receive Dank Memer leaderboard response after 3 attempts.');
        }
    }
}


    let responsePages = [];

    while (msg) {
        const embed = msg.embeds[0];
        const description = embed.description || '';
        const fieldsText = embed.fields?.map(f => `**${f.name}**\n${f.value}`).join('\n\n') || '';
        const content = `${description}\n${fieldsText}`;
        responsePages.push(content);

        const nextBtn = msg.components?.flatMap(row => row.components)?.find(btn =>
            btn.emoji?.id === '1379166099895091251' && btn.customId?.startsWith('pg:') && !btn.disabled
        );

        if (!nextBtn) break;
        try {
            await msg.clickButton(nextBtn.customId);
            await new Promise(res => setTimeout(res, 4000));
            msg = await channel.messages.fetch(msg.id);
        } catch {
            break;
        }
    }

    const botBalances = [];
    for (const page of responsePages) {
        for (const line of page.split('\n')) {
            const match = line.match(/[`]*\s*([\d,]+)\s*[`]*\s*-\s*.+\((\d{17,})\)/);
            if (match) {
                const [, balanceRaw, id] = match;
                if (!botIds.has(id)) continue;
                let balance = parseInt(balanceRaw.replace(/,/g, '')) || 0;
                balance = Math.max(0, balance - 100_000);
                botBalances.push({ id, balance });
            }
        }
    }

    if (botBalances.length === 0) {
        return mainBotMsg.edit('No eligible bots found with transferable balance.');
    }

    const selectOptions = botBalances.map((bot, i) => {
        const formatted = bot.balance.toLocaleString('en-US');
        return new StringSelectMenuOptionBuilder()
            .setLabel(`BOT ${i + 1} [CLAIMABLE: ${formatted}]`)
            .setValue(`${bot.id}|${bot.balance}`);
    });

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_claim_bot')
        .setPlaceholder('Select a bot to claim from')
        .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await mainBotMsg.edit({ content: 'Select a bot to claim from:', components: [row] });

    const collector = mainBotchannel.createMessageComponentCollector({
        filter: i => i.customId === 'select_claim_bot' && i.user.id === userId,
        componentType: ComponentType.StringSelect,
        time: 60000 // 2 minutes
    });

    collector.once('collect', async (interaction) => {
        const [botId, balance] = interaction.values[0].split('|');
        const formattedBalance = parseInt(balance).toLocaleString('en-US');

        const modal = new ModalBuilder()
            .setCustomId(`market_id_input_${botId}_${balance}_${userId}`)
            .setTitle('Enter Your Market ID')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('market_id')
                        .setLabel('Sell Market ID :')
                        .setStyle(TextInputStyle.Short)
                        .setMinLength(8)
                        .setMaxLength(8)
                        .setPlaceholder('e.g. A1B2C3D4')
                        .setRequired(true)
                )
            );

        try {
            await interaction.showModal(modal);
            await mainBotMsg.edit({ content: 'Payout inputbox closed', components: [] });
        } catch (e) {
            console.log('⚠️ Failed to show modal:', e);
        }
    });

    collector.on('end', async collected => {
        if (collected.size === 0) {
            try {
                await mainBotMsg.edit({ content: '❌ Claim selection timed out.', components: [] });
            } catch (e) {
                console.log('⚠️ Failed to edit timeout message:', e);
            }
        }
    });
}

module.exports = { handleClaimCommand };
