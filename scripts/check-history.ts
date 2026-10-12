import 'dotenv/config';
import { MarketProviders } from '../server/market/providers';
import { ASSET_BY_SYMBOL } from '../shared/assets';

async function main() {
  const providers = new MarketProviders();
  const testAssets = ['BTC', 'ETH', 'AAPL', 'SPY', 'USD/INR', 'XAU', 'RELIANCE', 'NIFTY50'];
  const testRanges = ['1D', '5D', '1M', '1Y'] as const;

  for (const sym of testAssets) {
    const asset = ASSET_BY_SYMBOL.get(sym);
    if (!asset) {
      console.log(`Symbol ${sym}: Not found in instrument directory`);
      continue;
    }
    for (const range of testRanges) {
      try {
        const points = await providers.history(asset, range);
        console.log(`[OK] ${sym} (${asset.category}) ${range}: ${points.length} points (first: ${points[0]?.time}, last: ${points.at(-1)?.time})`);
      } catch (err) {
        console.log(`[ERR] ${sym} (${asset.category}) ${range}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
}

main().catch(console.error);
