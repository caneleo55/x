import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

async function checkRedisStats() {
  try {
    console.log("\n📊 Redis Stats - Posted Wallets & Rate Limits\n");

    // Posted wallets (fresh wallets that tweeted)
    const postedWallets = await redis.keys("posted-wallet:*");
    console.log(`✅ Fresh Wallets Posted: ${postedWallets.length}`);

    // Fresh processed transactions (dedupe)
    const freshProcessed = await redis.keys("fresh-processed:*");
    console.log(`📝 Fresh Transactions Processed: ${freshProcessed.length}`);

    // Whale posted (rate limited)
    const whalePosted = await redis.keys("whale-posted:*");
    console.log(`🐋 Whale Wallets Posted: ${whalePosted.length}`);

    // Whale market cooldowns
    const marketCooldowns = await redis.keys("whale-market-cooldown:*");
    console.log(`⏰ Active Market Cooldowns: ${marketCooldowns.length}`);

    // Whale rate limits
    const walletRateLimits = await redis.keys("whale-rate:wallet:*");
    const marketRateLimits = await redis.keys("whale-rate:market:*");
    console.log(`🚦 Whale Wallet Rate Limits: ${walletRateLimits.length}`);
    console.log(`🚦 Whale Market Rate Limits: ${marketRateLimits.length}`);

    // Wallet history cache
    const walletHistory = await redis.keys("wallet-history:*");
    console.log(`💾 Cached Wallet Histories: ${walletHistory.length}`);

    console.log("\n📋 Recent Posted Wallets (last 10):");
    const recentWallets = postedWallets.slice(-10);
    for (const key of recentWallets) {
      const wallet = key.replace("posted-wallet:", "");
      console.log(`  - ${wallet.slice(0, 8)}...${wallet.slice(-6)}`);
    }

    // Check active whale cooldowns
    if (marketCooldowns.length > 0) {
      console.log("\n⏰ Active Market Cooldowns:");
      for (const key of marketCooldowns.slice(-5)) {
        const ttl = await redis.ttl(key);
        const marketId = key.replace("whale-market-cooldown:", "");
        const minutes = Math.floor(ttl / 60);
        console.log(`  - Market ${marketId.substring(0, 20)}... expires in ${minutes}m`);
      }
    }

    await redis.quit();
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    await redis.quit();
  }
}

checkRedisStats();
