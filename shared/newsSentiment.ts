import { ASSETS, ASSET_BY_SYMBOL } from './assets';

export type Sentiment = 'Positive' | 'Negative' | 'Neutral';

export interface ExtractedStockEntity {
  symbolOrName: string;
  evidence: string;
}

/**
 * Curated directory of common Indian and Global listed equities, benchmarks, and high-interest market entities.
 * Augments core ASSETS so news items for prominent companies (and new IPOs) are recognized instantly.
 */
export const EXPANDED_STOCK_ALIASES: Record<string, string[]> = {
  FUSIONCX: ['Fusion CX', 'Fusion CX Ltd', 'Fusion CX Limited', 'FusionCX'],
  ZOMATO: ['Zomato', 'Zomato Ltd'],
  SWIGGY: ['Swiggy', 'Swiggy Ltd'],
  PAYTM: ['Paytm', 'One97 Communications'],
  JIOFIN: ['Jio Financial Services', 'Jio Financial', 'Jio Fin'],
  ADANIENT: ['Adani Enterprises'],
  ADANIPORTS: ['Adani Ports', 'APSEZ'],
  ADANIGREEN: ['Adani Green Energy', 'Adani Green'],
  TATAPOWER: ['Tata Power'],
  TATASTEEL: ['Tata Steel'],
  SUZLON: ['Suzlon Energy', 'Suzlon'],
  OLAELEC: ['Ola Electric', 'Ola Electric Mobility'],
  WAAREE: ['Waaree Energies', 'Waaree Energy', 'Waaree'],
  HYUNDAI: ['Hyundai Motor India', 'Hyundai India'],
  PREMIERENE: ['Premier Energies'],
  BAJAJHLDNG: ['Bajaj Housing Finance'],
  ATHER: ['Ather Energy'],
  VEDL: ['Vedanta'],
  WIPRO: ['Wipro'],
  TECHM: ['Tech Mahindra'],
  MARUTI: ['Maruti Suzuki', 'Maruti'],
  BAJAJ_AUTO: ['Bajaj Auto'],
  ONGC: ['ONGC', 'Oil and Natural Gas Corporation'],
  COALINDIA: ['Coal India'],
  IREDA: ['IREDA', 'Indian Renewable Energy Development Agency'],
  NHPC: ['NHPC'],
  RVNL: ['Rail Vikas Nigam', 'RVNL'],
  IRFC: ['IRFC', 'Indian Railway Finance Corporation'],
  BEL: ['Bharat Electronics', 'BEL'],
  HAL: ['Hindustan Aeronautics', 'HAL'],
  MAZDOCK: ['Mazagon Dock Shipbuilders', 'Mazagon Dock'],
  BHEL: ['Bharat Heavy Electricals', 'BHEL'],
  DMART: ['Avenue Supermarts', 'DMart', 'D-Mart'],
  POLYCAB: ['Polycab India', 'Polycab'],
  DIXON: ['Dixon Technologies', 'Dixon'],
  TRENT: ['Trent Ltd', 'Trent'],
  MOTHERSON: ['Samvardhana Motherson', 'Motherson Sumi'],
  BDL: ['Bharat Dynamics', 'BDL'],
  CDSL: ['CDSL', 'Central Depository Services'],
  BSE: ['BSE Ltd'],
  MCX: ['Multi Commodity Exchange', 'MCX'],
  NYKAA: ['FSN E-Commerce', 'Nykaa'],
  POLICYBZR: ['PB Fintech', 'Policybazaar'],
  DELHIVERY: ['Delhivery'],
  YESBANK: ['Yes Bank'],
  IDFCFIRSTB: ['IDFC First Bank'],
  PNB: ['Punjab National Bank', 'PNB'],
  BANKBARODA: ['Bank of Baroda'],
  CANBK: ['Canara Bank'],
  UNIONBANK: ['Union Bank of India'],
  INDUSINDBK: ['IndusInd Bank'],
  KOTAKBANK: ['Kotak Mahindra Bank', 'Kotak Bank'],
  AXISBANK: ['Axis Bank'],
  DLF: ['DLF Ltd', 'DLF'],
  GODREJPROP: ['Godrej Properties'],
  SIEMENS: ['Siemens India', 'Siemens'],
  ABB: ['ABB India'],
  CGPOWER: ['CG Power'],
  KRNHEAT: ['KRN Heat Exchanger', 'KRN Heat'],
  DIFFUSION: ['Diffusion Engineers'],
};

const STOP_ENTITIES = new Set([
  'market', 'markets', 'stock', 'stocks', 'share', 'shares', 'nifty', 'sensex', 'bank nifty', 'bse sensex',
  'rupee', 'dollar', 'euro', 'yen', 'rbi', 'reserve bank', 'federal reserve', 'fed', 'government',
  'india', 'us', 'usa', 'wall street', 'treasury', 'treasuries', 'oil', 'gold', 'silver', 'crude', 'crude oil',
  'crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'central bank', 'union budget', 'inflation', 'economy',
  'gdp', 'global markets', 'asian markets', 'european markets', 'bullion', 'forex', 'sebi', 'finance ministry',
  'supreme court', 'high court', 'election', 'elections', 'today', 'yesterday', 'tomorrow', 'morning',
]);

const escaped = (value: string) =>
  [...value].map((char) => ('\\^$.*+?()[]{}|'.includes(char) ? `\\${char}` : char)).join('');

function mentionsWord(text: string, value: string, insensitive = true): boolean {
  return new RegExp(`(^|[^a-zA-Z0-9])${escaped(value)}(?=$|[^a-zA-Z0-9])`, insensitive ? 'i' : '').test(text);
}

/**
 * Extracts recognized company names or dynamic IPO/stock entities mentioned in a headline.
 */
export function extractStockEntities(text: string, existingSymbols: string[] = []): ExtractedStockEntity[] {
  const results: ExtractedStockEntity[] = [];
  const foundNames = new Set<string>(existingSymbols.map((s) => s.toLowerCase()));

  // 1. Check expanded directory of known stock aliases
  for (const [, aliases] of Object.entries(EXPANDED_STOCK_ALIASES)) {
    for (const name of aliases) {
      if (mentionsWord(text, name)) {
        if (!foundNames.has(name.toLowerCase())) {
          foundNames.add(name.toLowerCase());
          const display = aliases[0];
          results.push({
            symbolOrName: display,
            evidence: `Mentioned in headline: ${name}`,
          });
        }
        break;
      }
    }
  }

  // 2. Syntactic entity extraction for IPOs and breaking stock news:
  // e.g. "Fusion CX lists at 5% premium...", "Acme Corp shares rally...", "Nova Tech IPO opens..."
  const leadMatch = text.match(
    /^([A-Z][A-Za-z0-9&.'\s-]{1,35}?)\s+(?:lists|debuts|files for IPO|IPO|shares|stock|stocks|rallies|surges|jumps|tanks|plunges|falls|slips|gains|reports|posts|bags|wins|secures|announces|to raise|to acquire|to buy)\b/i
  );
  if (leadMatch && leadMatch[1]) {
    const rawCandidate = leadMatch[1].trim();
    // If it contains conjunctions like "TCS and HDFC Bank", split into individual items
    const subCandidates = rawCandidate.split(/\s+(?:and|or|vs|with|&)\s+/i);
    for (const candidate of subCandidates) {
      const candidateTrimmed = candidate.trim();
      const candidateLower = candidateTrimmed.toLowerCase();
      const isAlreadyCovered =
        existingSymbols.some((sym) => {
          const symLower = sym.toLowerCase();
          const asset = ASSET_BY_SYMBOL.get(sym.toUpperCase());
          return (
            symLower === candidateLower ||
            candidateLower.includes(symLower) ||
            Boolean(asset && (asset.name.toLowerCase() === candidateLower || candidateLower.includes(asset.name.toLowerCase())))
          );
        }) ||
        ASSETS.some(
          (a) => a.symbol.toLowerCase() === candidateLower || a.name.toLowerCase() === candidateLower
        );
      if (
        !isAlreadyCovered &&
        !STOP_ENTITIES.has(candidateLower) &&
        candidateTrimmed.length >= 2 &&
        !foundNames.has(candidateLower)
      ) {
        foundNames.add(candidateLower);
        results.push({
          symbolOrName: candidateTrimmed,
          evidence: `Extracted company entity from headline: ${candidateTrimmed}`,
        });
      }
    }
  }

  // 3. Suffix match for corporate entities: e.g. "Acme Ltd", "Nova Corp", "Global Inc"
  const suffixMatch = text.match(
    /\b([A-Z][A-Za-z0-9&.'\s-]{1,30}?\s+(?:Ltd|Limited|Corp|Corporation|Inc))\b/
  );
  if (suffixMatch && suffixMatch[1]) {
    const candidate = suffixMatch[1].trim();
    const candidateLower = candidate.toLowerCase();
    const isAlreadyCovered =
      existingSymbols.some((sym) => {
        const symLower = sym.toLowerCase();
        const asset = ASSET_BY_SYMBOL.get(sym.toUpperCase());
        return (
          symLower === candidateLower ||
          candidateLower.includes(symLower) ||
          Boolean(asset && (asset.name.toLowerCase() === candidateLower || candidateLower.includes(asset.name.toLowerCase())))
        );
      }) ||
      ASSETS.some(
        (a) => a.symbol.toLowerCase() === candidateLower || a.name.toLowerCase() === candidateLower
      );
    if (!isAlreadyCovered && !STOP_ENTITIES.has(candidateLower) && candidate.length >= 3 && !foundNames.has(candidateLower)) {
      foundNames.add(candidateLower);
      results.push({
        symbolOrName: candidate,
        evidence: `Corporate entity mention in headline: ${candidate}`,
      });
    }
  }

  return results;
}

const POSITIVE_PATTERNS = [
  /\blists? at (?:\d+%)?\s*premium\b/i,
  /\bpremium over ipo\b/i,
  /\blists? with (?:a )?gain\b/i,
  /\bdebuts? at premium\b/i,
  /\boversubscribed\b/i,
  /\b\d+(?:\.\d+)?x subscription\b/i,
  /\bstrong (?:debut|listing|demand)\b/i,
  /\bbumper listing\b/i,
  /\bblockbuster listing\b/i,
  /\b(?:net )?profits? (?:jumps?|rises?|surges?|soars?|up|doubles?|climbs?|grows?)\b/i,
  /\brevenues? (?:up|rises?|grows?|surges?|jumps?)\b/i,
  /\bsales (?:up|rise|jump|grow|surge)\b/i,
  /\bbeats? (?:estimates|expectations|forecasts?)\b/i,
  /\brecord (?:profit|revenue|high|earnings|order)\b/i,
  /\bmargin expansion\b/i,
  /\bdeclared? (?:a )?dividend\b/i,
  /\bbonus (?:shares|issue)\b/i,
  /\bstock split\b/i,
  /\bbuyback\b/i,
  /\b(?:shares?|stock|stocks?) (?:surges?|soars?|rallies|rally|jumps?|climbs?|advances?|gains?)\b/i,
  /\b(?:rallies|surges|jumps|soars|gains) (?:up to )?\d+%/i,
  /\b(?:hits?|touches?) (?:fresh |new )?(?:52-week |all-time |record )?high\b/i,
  /\bupper circuit\b/i,
  /\bbullish\b/i,
  /\bupbeat\b/i,
  /\bupgrades?(?:d)?\b/i,
  /\bbuy rating\b/i,
  /\boutperforms?\b/i,
  /\b(?:wins?|bags?|secures?) (?:mega |new |multi-year )?(?:contract|order|deal|tender|project)\b/i,
  /\b(?:receives?|secures?|gets?) (?:usfda |fda |regulatory |patent )?approval\b/i,
  /\bstrategic partnership\b/i,
  /\bexpansion\b/i,
  /\bexpands renewable\b/i,
];

const NEGATIVE_PATTERNS = [
  /\blists? at (?:\d+%)?\s*discount\b/i,
  /\bbelow ipo price\b/i,
  /\btepid (?:listing|debut)\b/i,
  /\bweak (?:listing|debut|demand)\b/i,
  /\bpoor debut\b/i,
  /\blists? below\b/i,
  /\b(?:net )?loss(?:es)? (?:widens?|deepens?)\b/i,
  /\bposts? (?:net )?loss\b/i,
  /\b(?:net )?profits? (?:falls?|drops?|slumps?|plunges?|down|tumbles?|slides?)\b/i,
  /\brevenues? (?:down|drops?|falls?|slumps?)\b/i,
  /\bmisses? (?:estimates|expectations|forecasts?)\b/i,
  /\bmargin contraction\b/i,
  /\b(?:shares?|stock|stocks?) (?:plunges?|tanks?|slumps?|slides?|tumbles?|crashes?|falls?|drops?|slips?)\b/i,
  /\b(?:plunges|tanks|slumps|slides|falls|drops|slips) (?:up to )?\d+%/i,
  /\b(?:hits?|touches?) (?:fresh |new )?(?:52-week |all-time )?low\b/i,
  /\blower circuit\b/i,
  /\bbearish\b/i,
  /\bdowngrades?(?:d)?\b/i,
  /\bsell rating\b/i,
  /\bunderperforms?\b/i,
  /\bselloff\b/i,
  /\bpenalty\b/i,
  /\bprobe\b/i,
  /\binvestigation\b/i,
  /\braids?\b/i,
  /\bfraud\b/i,
  /\bscam\b/i,
  /\bdefaults?(?:ed)?\b/i,
  /\bdebt crisis\b/i,
  /\bbankruptcy\b/i,
  /\binsolvency\b/i,
  /\blayoffs?\b/i,
  /\bjob cuts\b/i,
  /\bfires?\b/i,
  /\bbans?\b/i,
  /\bcurbs?\b/i,
  /\blawsuit\b/i,
  /\bsebi notice\b/i,
  /\bshow cause notice\b/i,
  /\bregulatory action\b/i,
  /\bservice complaints\b/i,
];

/**
 * Fast, deterministic financial headline sentiment classifier.
 * Evaluates market terminology, corporate earnings, IPO listing premiums/discounts,
 * and price momentum phrases to classify into 'Positive', 'Negative', or 'Neutral'.
 */
export function analyzeHeadlineSentiment(headline: string, summary: string = ''): Sentiment {
  const text = `${headline} ${summary}`.trim();
  if (!text) return 'Neutral';

  let positiveScore = 0;
  let negativeScore = 0;

  for (const pattern of POSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      positiveScore += 1;
    }
  }

  for (const pattern of NEGATIVE_PATTERNS) {
    if (pattern.test(text)) {
      negativeScore += 1;
    }
  }

  if (positiveScore > negativeScore) return 'Positive';
  if (negativeScore > positiveScore) return 'Negative';
  return 'Neutral';
}
