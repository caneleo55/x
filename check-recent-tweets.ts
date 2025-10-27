import dotenv from "dotenv";
dotenv.config();

import { TwitterApi } from "twitter-api-v2";

const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY!,
  appSecret: process.env.TWITTER_API_SECRET!,
  accessToken: process.env.TWITTER_ACCESS_TOKEN!,
  accessSecret: process.env.TWITTER_ACCESS_SECRET!,
});

async function checkRecentTweets() {
  try {
    const twitter = client.readWrite;

    // Get authenticated user
    const me = await twitter.v2.me();
    console.log(`\n📊 Checking tweets for: @${me.data.username}\n`);

    // Get recent tweets (last 10)
    const timeline = await twitter.v2.userTimeline(me.data.id, {
      max_results: 10,
      'tweet.fields': ['created_at', 'text']
    });

    let freshCount = 0;
    let whaleCount = 0;

    console.log("Recent tweets:\n");
    for (const tweet of timeline.data.data || []) {
      const type = tweet.text.includes('👀 Fresh wallet') ? '👀 FRESH' :
                   tweet.text.includes('🐋 Whale') ? '🐋 WHALE' : '📝 OTHER';

      if (type === '👀 FRESH') freshCount++;
      if (type === '🐋 WHALE') whaleCount++;

      console.log(`${type} | ${tweet.created_at}`);
      console.log(`${tweet.text.substring(0, 100)}...\n`);
    }

    console.log(`\n📈 Summary: ${freshCount} fresh wallet tweets, ${whaleCount} whale tweets\n`);

  } catch (err: any) {
    console.error("❌ Error:", err.message);
    if (err.data) {
      console.error("Details:", JSON.stringify(err.data, null, 2));
    }
  }
}

checkRecentTweets();
