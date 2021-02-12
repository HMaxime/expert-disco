require('dotenv').config();

const Discord = require('discord.js');
const discordClient = new Discord.Client();

const { MongoClient } = require("mongodb");
const { resolve } = require('mongodb/lib/core/topologies/read_preference');

const { YTSearcher } = require('ytsearcher');
const searcher = new YTSearcher(process.env.YOUTUBE_API_KEY);

const providers = ["YouTube", "Spotify"]

const dbUrl = `mongodb+srv://${process.env.DB_CLIENT_NAME}:${process.env.DB_PASSWORD}@${process.env.CLUSTER_NAME}/${process.env.DB_NAME}?retryWrites=true&w=majority`
const mongoClient = new MongoClient(dbUrl, { useUnifiedTopology: true });

const onlyUnique = (value, index, self) => {
    return self.indexOf(value) === index;
}

const getYoutubeLink = async msg => {
    const embed = msg.embeds[0]
    if (embed?.provider?.name === "Spotify") {
        const url = (await searcher.search(embed.title + embed.description, { type: "video", maxResults: 1 }))?.first?.url
        //const url = new Promise(resolve => setTimeout(() => resolve("truc"), 100))

        return url || embed.url
    } else {
        return embed.url
    }
}

mongoClient.connect().then(() => {
    const database = mongoClient.db(process.env.DB_NAME)
    const collection = database.collection(process.env.DB_NAME)

    discordClient.on('ready', async () => {
        console.log(`Logged in as ${discordClient.user.tag}!`);
        discordClient.user.setActivity('chat', { type: 'PLAYING' });
        const limit = 100
        let messages = []
        let before = undefined
        let links = []
        try {
            console.log("Starting indexation...")
            do {
                messages = await (await discordClient.channels.fetch(process.env.ID_SEARCH_CHANNEL)).messages.fetch({ limit: limit, before: before })
                links = (await Promise.all(getDatasFromMessages(messages)
                    .map(d => d.musicUrl)))
                    .filter(onlyUnique)
                try {
                    await collection.insertMany(links.map(l => { return { _id: l } }), { ordered: false });
                    links.forEach(l => console.log(`${l} Added`))
                } catch (e) { }

                before = messages?.last()?.id
            } while (messages.size == limit)
        } catch (error) {
            console.error(error)
        } finally {
            console.log("\nIndexation finished")
        }
    });

    const getDatasFromMessages = (messages) => {
        return messages.filter(msg => {
            return msg.embeds
                .map(e => providers.includes(e.provider?.name))
                .includes(true)
        }).map(msg => {
            return {
                idMessage: msg.id,
                musicUrl: getYoutubeLink(msg),
            }
        })
    }

    discordClient.on('message', async msg => {
        if (msg.channel.id === process.env.ID_CALL_CHANNEL) {
            const args = msg.content.split(" ")
            if (args.includes("-rm") || args.includes("-randomMusic")) {
                // get random music from database
                try {
                    await collection.aggregate([{ $sample: { size: 1 } }])
                        .toArray()
                        .then(d => {
                            msg.reply(d[0]._id)
                        })
                } catch (error) {
                    console.error(error)
                }
            }
        } else if (msg.channel.id === process.env.ID_SEARCH_CHANNEL && msg.embeds.map(e => providers.includes(e.provider?.name)).includes(true)) {
            // Add music to the database if it is a music
            const link = await getYoutubeLink(msg)
            console.log(`${link} Added`)
            await collection.replaceOne({ "_id": link }, { _id: link }, { upsert: true })
        }
    });

    discordClient.login(process.env.BOT_TOKEN);
})
