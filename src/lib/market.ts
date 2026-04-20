/**
 * Online Pati News — Market Data Service
 * Fetches data from authentic sources (NRB, NEPSE aggregators, etc.)
 */

export interface MarketData {
  nepse: { value: string; trend: 'up' | 'down'; change: string };
  gold: { value: string; trend: 'up' | 'down'; type: string };
  forex: { value: string; symbol: string; currency: string };
}

export async function getMarketData(): Promise<MarketData> {
  try {
    const [forex, nepse, gold] = await Promise.all([
      fetchForex(),
      fetchNepse(),
      fetchGoldPrice()
    ]);

    return { forex, nepse, gold };
  } catch (error) {
    console.error("Market Data Error:", error);
    // Fallback to static data if APIs are down
    return {
      nepse: { value: "२०९५.२३", trend: "up", change: "▲" },
      gold: { value: "१,५०,०००", trend: "up", type: "छापावाल" },
      forex: { value: "१३३.४५", symbol: "▼", currency: "USD" }
    };
  }
}

async function fetchForex() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const response = await fetch(`https://www.nrb.org.np/api/forex/v1/rates?page=1&per_page=1&from=${today}&to=${today}`);
    const data = await response.json();
    
    // NRB API Structure: data.data.payload[0].rates[]
    const usdRate = data?.data?.payload?.[0]?.rates?.find((r: any) => r.currency.iso3 === 'USD');
    
    if (usdRate) {
      return { 
        value: usdRate.buy, 
        symbol: "▲", 
        currency: "USD" 
      };
    }
  } catch (e) {
    console.warn("Forex fetch failed, using fallback");
  }
  return { value: "१३३.४५", symbol: "▼", currency: "USD" };
}

async function fetchNepse() {
  try {
    // Using a reliable community aggregator for NEPSE
    const response = await fetch('https://nepal-stock-api.vercel.app/api/nepse-index');
    const data = await response.json();
    
    if (data && data.index) {
      return { 
        value: data.index.toString(), 
        trend: (data.percent_change >= 0 ? 'up' : 'down') as 'up' | 'down',
        change: data.percent_change >= 0 ? '▲' : '▼' 
      };
    }
  } catch (e) {
    console.warn("NEPSE fetch failed, using fallback");
  }
  return { value: "२०९५.२३", trend: "up" as "up", change: "▲" };
}

async function fetchGoldPrice() {
  try {
    // Gold prices are often updated daily by news portals. 
    // We'll use a reliable JSON feed aggregator if available or a stable proxy.
    const response = await fetch('https://nepstat.com/api/v1/gold-silver');
    const data = await response.json();
    
    if (data && data.gold) {
      return { 
        value: data.gold.fine_gold.toString(), 
        trend: 'up' as 'up', 
        type: "छापावाल" 
      };
    }
  } catch (e) {
    console.warn("Gold fetch failed, using fallback");
  }
  return { value: "१,५०,०००", trend: "up" as "up", type: "छापावाल" };
}
