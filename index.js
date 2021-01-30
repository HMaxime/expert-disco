require('dotenv').config();

const Discord = require('discord.js');
const client = new Discord.Client();
const { YTSearcher } = require('ytsearcher');
const searcher = new YTSearcher(process.env.API_KEY);

const providers = ["YouTube", "Spotify"]

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    client.user.setActivity('https://git.io/d.js-heroku', {type: 'WATCHING'});
});

const Music = (e) => {
    return {
        "title": e.title,
        "description": e.description,
        "provider": e.provider.name,
        "url": e.url
    }
}

client.on('message', async msg => {
    if (msg.channel.id === process.env.ID_CALL_CHANNEL) {
        const args = msg.content.split(" ")
        if (args.includes("-rm") || args.includes("-randomMusic")) {

            const musics = (await (await client.channels.fetch(process.env.ID_SEARCH_CHANNEL)).messages.fetch())
                .filter(msg => msg.embeds
                    .map(e => providers.includes(e.provider?.name))
                    .includes(true))
                .map(msg => msg.embeds.map(e => Music(e)))
                .flat()

            if(!musics){
                msg.reply("Music not found")
                return
            }
            console.log(`Music found : ${musics.length}`)
            const randomMusic = musics[Math.floor(Math.random() * musics.length)]

            if (randomMusic?.provider === "Spotify") {
                const ytUrl = (await searcher.search(randomMusic.title + randomMusic.description, { type: "video", maxResults: 1 }))?.first?.url
                if (ytUrl) randomMusic.url = ytUrl
            }
            
            msg.reply(randomMusic?.url || "Music not found")
        }
    }
});

client.login(process.env.BOT_TOKEN);