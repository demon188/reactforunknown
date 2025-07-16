const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DANK_ID = '270904126974590976';
const BOT_OUTPUT_CHANNEL_BANK = '1394385252180426762'; // Channel to send results
const BOT_OUTPUT_CHANNEL_POCKET = '1394943078728470528'; // Channel to send results
let scannerClient;
let mainBot;
const activeScans = new Map(); // Track running scans by guildId:channelId

const ignoredUserIds = new Set([
    '1386079772521533451', '1386074841320526050', '1386084166889635880',
    '1386083090153345125', '1386093184177668150', '1386094110498361444',
    '1386086622117892267', '1386077382406045816', '1386090476477743254',
    '1386078633134915685', '1386071595482878082', '1386095515170770954'
]);

async function runFullScan(guildId, channelId, li, inv = 1, threshold = 0, statusMsg = null) {
    li = li.toLowerCase();

    const statusData = {
        page: 1,
        totalPages: 1,
        found: 0,
        current: 0,
        total: 0,
        robable: 0,
        state: 'Initializing...'
    };

    let guildName = 'Unknown';
    let robType = li === 'bank' ? 'Bank' : 'Pocket';

    async function updateStatus() {
        if (!statusMsg) return;
        const content = `**Robbing Scan Status:\n**\u0060\u0060\u0060js\nServer: ${guildName}\nRob Type: ${robType}\nFilter: ≥ ${threshold / 1_000_000}M\nInterval: ${inv}s\n\nPages collected: ${statusData.page}\nUser IDs Found: ${statusData.found}\nRobable Users: ${statusData.robable}\nStatus: ${statusData.state}\n\u0060\u0060\u0060`;
        try {
            await statusMsg.edit({ content });
        } catch (err) {
            console.warn('⚠️ Failed to update status message:', err.message);
        }
    }

    async function finalizeStatus(text) {
        if (statusMsg) {
            try {
                await statusMsg.edit({ content: text, components: [] });
            } catch (e) {
                console.warn('⚠️ Failed to finalize status message:', e.message);
            }
        }
    }

    
    async function sendRobResults(robableUsers, title) {
    try {
        const robChannelId = robType.toLowerCase() === 'bank' ? BOT_OUTPUT_CHANNEL_BANK : BOT_OUTPUT_CHANNEL_POCKET;
        const resultChannel = await mainBot.channels.fetch(robChannelId);

        const emoji = robType.toLowerCase() === 'bank' ? ':bank:' : ':coin:';

        const robableText = robableUsers
        .map(u => u.line?.replace(/🔹/g, robType.toLowerCase() === 'bank' ? ':bank:' : ':coin:'))
        .filter(Boolean)
        .join('\n') || 'No robable users found.';

        const outputText = `<@&1394390804713439365>\n🏷️ **Server:** ${guildName}\n🏴‍☠️ Rob type:** ${robType}** ≥ ${threshold / 1_000_000}m.\n📋 **${title}:**\n${robableText}`;

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
    } catch (err) {
        console.warn('⚠️ Failed to send robable list to output channel:', err.message);
    }
}

    const scanKey = `${guildId}:${channelId}`;
    activeScans.set(scanKey, { cancelled: false });

    console.log(`▶️ Robbing strategy: ${li} | Interval: ${inv}s | Threshold: ${threshold}`);
    const guild = scannerClient.guilds.cache.get(guildId);
    guildName = guild?.name || guildName;
    if (!guild) return console.error('❌ Guild not found.');

    const channel = guild.channels.cache.get(channelId);
    if (!channel) return console.error('❌ Channel not found.');

    try {
        const capitalizedLi = li.charAt(0).toUpperCase() + li.slice(1);
        console.log(`📤 Sending slash command: /leaderboard stats ${li}`);

        statusData.state = 'Slash command sent...';
        await updateStatus();

        const slashMsg = await channel.sendSlash(DANK_ID, 'leaderboard stats', capitalizedLi);
        if (activeScans.get(scanKey)?.cancelled) {
            await finalizeStatus('🚫 Scan cancelled.');
            return;
        }

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
            if (activeScans.get(scanKey)?.cancelled) {
                await finalizeStatus('🚫 Scan cancelled.');
                return;
            }

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
                statusData.page++;
                statusData.state = `Reading leaderboard page ${statusData.page}`;
                await updateStatus();

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

        statusData.found = userIds.length;
        statusData.total = userIds.length;
        statusData.state = 'Robbing started...';
        await updateStatus();

        const robNext = async () => {
            if (activeScans.get(scanKey)?.cancelled) {
                await sendRobResults(robableUsers, 'Robbed Before Cancel');
                await finalizeStatus('🚫 Scan cancelled.');
                activeScans.delete(scanKey);
                return;
            }

            if ((li === 'p' && index >= userIds.length && repeatCount === 0) || (li !== 'p' && index >= userIds.length)) {
                statusData.state = '✅ Scan completed!';
                await updateStatus();
                await sendRobResults(robableUsers, 'Filtered Robable Users');
                await finalizeStatus(`✅ Scan completed in **${guildName}**. Found **${robableUsers.length}** robbable users for **${robType}** ≥ ${threshold / 1_000_000}m.`);
                activeScans.delete(scanKey);
                return;
            }

            const userId = userIds[index];
            statusData.current = index + 1;
            statusData.state = `Checking user ${statusData.current}/${statusData.total}`;
            await updateStatus();

         
            try {
                const slashMsg = await channel.sendSlash(DANK_ID, 'rob', userId);

                // Collect all possible content sources
                let fullTextContent = '';
                if (slashMsg.content) fullTextContent += slashMsg.content + ' ';
                if (slashMsg.embeds?.length) {
                    const embed = slashMsg.embeds[0];
                    if (embed.description) fullTextContent += embed.description + ' ';
                    if (embed.fields?.length) {
                        embed.fields.forEach(f => {
                            fullTextContent += ` ${f.name} ${f.value} `;
                        });
                    }
                }
                if (slashMsg.components?.length) {
                    slashMsg.components.forEach(row => {
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

                // Cancel scan if robbing is disabled
                if (lower.includes('robbing is disabled') || lower.includes('rob protection')) {
                    console.warn('🚫 Robbing disabled detected. Cancelling scan.');
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

                if (!lower.includes('passive') && !lower.includes('lottery') && !lower.includes('not a member') && !lower.includes('you must pass captcha') && !lower.includes('hey stupid') && !lower.includes('unable to interact')) {
                    robableUsers.push({ id: userId, line: userLineMap.get(userId) });
                    statusData.robable = robableUsers.length;
                }
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
