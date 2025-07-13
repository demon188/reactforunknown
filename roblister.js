const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DANK_ID = '270904126974590976';



let scannerClient;
let mainBot;
const activeScans = new Map(); // Track running scans by guildId:channelId

const ignoredUserIds = new Set([
    '1386079772521533451',
    '1386074841320526050',
    '1386084166889635880',
    '1386083090153345125',
    '1386093184177668150',
    '1386094110498361444',
    '1386086622117892267',
    '1386077382406045816',
    '1386090476477743254',
    '1386078633134915685',
    '1386071595482878082',
    '1386095515170770954'
]);

async function runFullScan(guildId, channelId, li, inv = 1, threshold = 0, statusMsg = null) {
    li = li.toLowerCase();
    const scanKey = `${guildId}:${channelId}`;
    activeScans.set(scanKey, { cancelled: false });

    console.log(`▶️ Robbing strategy: ${li} | Interval: ${inv}s | Threshold: ${threshold}`);

    const guild = scannerClient.guilds.cache.get(guildId);
    const guildName = guild?.name;
    if (!guild) return console.error('❌ Guild not found.');

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return console.error('❌ Channel not found.');

    try {
        const capitalizedLi = li.charAt(0).toUpperCase() + li.slice(1);
        console.log(`📤 Sending slash command: /leaderboard stats ${li}`);

        const slashMsg = await channel.sendSlash(DANK_ID, 'leaderboard stats', capitalizedLi);

        if (activeScans.get(scanKey)?.cancelled) return cancelCleanup();

        let responseMsg;
        if (slashMsg.flags?.has?.('LOADING')) {
            console.log('⏳ Dank Memer is thinking...');
            responseMsg = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject('❌ Timeout after 15 seconds'), 15000);
                const listener = (oldMsg, newMsg) => {
                    if (oldMsg.id === slashMsg.id && newMsg.author.id === DANK_ID && newMsg.embeds.length > 0) {
                        clearTimeout(timeout);
                        scannerClient.off('messageUpdate', listener);
                        resolve(newMsg);
                    }
                };
                scannerClient.on('messageUpdate', listener);
            });
        } else {
            responseMsg = slashMsg;
        }

        if (!responseMsg || !responseMsg.embeds?.length || !responseMsg.components?.length) {
            return console.warn('❌ No valid slash response from Dank Memer.');
        }

        const userLineMap = new Map();
        const visitedPages = new Set();
        let msg = responseMsg;

        while (msg) {
            if (activeScans.get(scanKey)?.cancelled) return cancelCleanup();

            const embed = msg.embeds[0];
            const description = embed.description || '';
            const fieldsText = embed.fields?.map(f => `**${f.name}**\n${f.value}`).join('\n\n') || '';
            const content = `${description}\n${fieldsText}`;
            const pageKey = content.slice(0, 200);

            if (visitedPages.has(pageKey)) break;
            visitedPages.add(pageKey);

            const lines = content.split('\n');
            for (const line of lines) {
                const match = line.match(/\((\d{17,})\)/);
                const userId = match?.[1];
                const coinMatch = line.match(/`?\s*([\d,]+)\s*`?/);
                const coinValue = coinMatch ? parseInt(coinMatch[1].replace(/,/g, '')) : 0;

                if (userId && !ignoredUserIds.has(userId) && coinValue >= threshold) {
                    userLineMap.set(userId, line);
                }
            }

            const nextBtn = msg.components.flatMap(row => row.components).find(btn =>
                btn.emoji?.id === '1379166099895091251' &&
                btn.customId?.startsWith('pg:') &&
                !btn.disabled
            );

            if (!nextBtn) break;

            try {
                await msg.clickButton(nextBtn.customId);
               // console.log('➡️ Clicked ArrowRightui (next page)');
                await new Promise(res => setTimeout(res, 4000));
                msg = await channel.messages.fetch(msg.id);
            } catch (err) {
                console.error('❌ Failed to click next page:', err.message);
                break;
            }
        }

        const userIds = Array.from(userLineMap.keys());
        const robableUsers = [];
        let index = 0;
        let repeatCount = 0;

        const robNext = async () => {
            if (activeScans.get(scanKey)?.cancelled) return cancelCleanup();

            if ((li === 'p' && index >= userIds.length && repeatCount === 0) || (li !== 'p' && index >= userIds.length)) {
                console.log('✅ Finished robbing.');
                
                const robableText = robableUsers
                    .map(u => u.line)
                    .filter(Boolean)
                    .join('\n') || 'No robable users found.';

                const outputText = `🏷️ **Server:** ${guildName}\n🏴‍☠️ Rob type:** ${li === 'bank' ? 'Bank' : 'Pocket'}** ≥ ${threshold / 1_000_000}m.\n📋 **Filtered Robable Users:**\n${robableText}`;

               try {
  const resultChannel = await mainBot.channels.fetch('1394032318871638018');

  const CHUNK_LIMIT = 2000;
  const lines = outputText.split('\n');

  let currentChunk = '';
  for (const line of lines) {
    // +1 accounts for the newline character we're adding back
    if ((currentChunk + line + '\n').length > CHUNK_LIMIT) {
      await resultChannel.send(currentChunk);
      currentChunk = '';
    }
    currentChunk += line + '\n';
  }

  if (currentChunk.trim().length > 0) {
    await resultChannel.send(currentChunk);
  }

  console.log('✅ Sent robable user list (in clean chunks).');
} catch (err) {
  console.warn('⚠️ Failed to send robable list:', err.message);
}


                if (statusMsg) {
                try {
                    await statusMsg.edit({
                    content: `✅ Scan completed in **${guildName}**!\n\nFound **${robableUsers.length}** robbable users for **${li === 'bank' ? 'Bank' : 'Pocket'}** ≥ ${threshold / 1_000_000}m.`,
                    components: []
                    });
                } catch (e) {
                    console.warn('⚠️ Failed to edit status message:', e.message);
                }
                }

                activeScans.delete(scanKey);
                return;
            }

            const userId = userIds[index];
            if (!userId) {
                index++;
                repeatCount = 0;
                return setTimeout(robNext, inv * 1000);
            }

            try {
                const slashMsg = await channel.sendSlash(DANK_ID, 'rob', userId);
                let finalMessage;

                if (slashMsg.flags?.has?.('LOADING')) {
                    finalMessage = await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject('❌ Timeout after 15 seconds'), 15000);
                        const listener = (oldMsg, newMsg) => {
                            if (oldMsg.id === slashMsg.id && newMsg.author.id === DANK_ID) {
                                clearTimeout(timeout);
                                scannerClient.off('messageUpdate', listener);
                                resolve(newMsg);
                            }
                        };
                        scannerClient.on('messageUpdate', listener);
                    });
                } else {
                    finalMessage = slashMsg;
                }

                let fullTextContent = '';
                if (finalMessage.content) fullTextContent += finalMessage.content + ' ';
                if (finalMessage.embeds?.length) {
                    const embed = finalMessage.embeds[0];
                    if (embed.description) fullTextContent += embed.description + ' ';
                    if (embed.fields?.length) {
                        embed.fields.forEach(f => {
                            fullTextContent += ` ${f.name} ${f.value} `;
                        });
                    }
                }
                if (finalMessage.components?.length) {
                    finalMessage.components.forEach(row => {
                        if (row.components?.length) {
                            row.components.forEach(comp => {
                                if (comp?.content) {
                                    fullTextContent += comp.content + ' \n';
                                } else if (comp?.label) {
                                    fullTextContent += comp.label + ' \n';
                                } else if (comp?.custom_id) {
                                    fullTextContent += `[Component ID: ${comp.custom_id}] \n`;
                                }
                            });
                        }
                    });
                }


               const lower = fullTextContent.toLowerCase();

if (lower.includes('robbing is disabled') || lower.includes('rob protection')) {
    console.warn(`🚫 Robbing disabled detected. Cancelling scan.`);
    activeScans.delete(scanKey);
    if (statusMsg) {
        try {
            await statusMsg.edit({
                content: '❌ Scan cancelled — Robbing is disabled in this server.',
                components: []
            });
        } catch (_) {}
    }
    return;
}

if (
    !lower.includes('passive') &&
    !lower.includes('lottery') &&
    !lower.includes('not a member') &&
    !lower.includes('hey stupid') &&
    !lower.includes('unable to interact')
) {
    robableUsers.push({ id: userId, line: userLineMap.get(userId) });
}



              //  console.log(`📤 Sent rob for <@${userId}> (${li === 'p' ? `${repeatCount + 1}/5` : '1'})`);
            } catch (err) {
                console.warn(`❌ Failed rob for ${userId}:`, err.message);
            }

            if (li === 'p') {
                repeatCount++;
                if (repeatCount >= 5) {
                    repeatCount = 0;
                    index++;
                }
            } else {
                index++;
            }

            setTimeout(robNext, inv * 1000);
        };

        robNext();

      async function cancelCleanup() {
    console.log('🚫 Scan cancelled.');
    activeScans.delete(scanKey);

    if (robableUsers.length > 0) {
        const robableText = robableUsers
            .map(u => u.line)
            .filter(Boolean)
            .join('\n') || 'No robable users found.';

        const outputText = `🏷️ **Server:** ${guildName}\n🏴‍☠️ Rob type:** ${li === 'bank' ? 'Bank' : 'Pocket'}** ≥ ${threshold / 1_000_000}m.\n📋 **Robbed Before Cancel:**\n${robableText}`;


        try {
            const resultChannel = await mainBot.channels.fetch('1394032318871638018');
            const CHUNK_LIMIT = 2000;
            const lines = outputText.split('\n');

            let currentChunk = '';
            for (const line of lines) {
                if ((currentChunk + line + '\n').length > CHUNK_LIMIT) {
                    await resultChannel.send(currentChunk);
                    currentChunk = '';
                }
                currentChunk += line + '\n';
            }

            if (currentChunk.trim().length > 0) {
                await resultChannel.send(currentChunk);
            }

            console.log('✅ Sent partial rob list before cancellation.');
        } catch (err) {
            console.warn('⚠️ Failed to send partial rob list:', err.message);
        }
    }

    if (statusMsg) {
        try {
            await statusMsg.edit({ content: '🚫 Scan cancelled.', components: [] });
        } catch (_) {}
    }
}


    } catch (err) {
        console.error('❌ Fatal error in scan:', err);
        activeScans.delete(scanKey);
    }
}

function setScannerClient(client, bot) {
    scannerClient = client;
    mainBot = bot;
}

function cancelScan(guildId, channelId) {
    const key = `${guildId}:${channelId}`;
    if (activeScans.has(key)) {
        activeScans.get(key).cancelled = true;
        return true;
    }
    return false;
}

module.exports = { setScannerClient, runFullScan, cancelScan };