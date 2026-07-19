import React, { useState } from 'react';
import { Newspaper, Cpu, RefreshCw, Sparkles, Filter, Brain, Zap, TrendingUp, TrendingDown, Gauge } from 'lucide-react';
import { NewsItem, ThemeColors } from '../types/market';

interface NewsSignalFeedProps {
  news: NewsItem[];
  colors: ThemeColors;
  apiKeyMissing: boolean;
  onAnalyzeHeadline: (id: string, engine?: 'gemini' | 'finbert') => void;
  isLoading: boolean;
  activeEngine: 'gemini' | 'finbert';
  onEngineChange: (engine: 'gemini' | 'finbert') => void;
}

export default function NewsSignalFeed({
  news,
  colors,
  apiKeyMissing,
  onAnalyzeHeadline,
  isLoading,
  activeEngine,
  onEngineChange
}: NewsSignalFeedProps) {
  const [sentimentFilter, setSentimentFilter] = useState<'All' | 'Positive' | 'Negative' | 'Neutral'>('All');

  // Filter headlines based on user selections
  const filteredNews = news.filter((item) => {
    if (sentimentFilter === 'All') return true;
    return item.analysis?.sentiment === sentimentFilter;
  });

  // Calculate probabilities helper to guarantee progress bar displays beautifully
  const getProbabilities = (analysis: any) => {
    if (analysis.probabilities) {
      // Handle decimal weights (0 to 1) or percentage values (0 to 100) gracefully
      const pos = analysis.probabilities.positive <= 1 ? analysis.probabilities.positive * 100 : analysis.probabilities.positive;
      const neg = analysis.probabilities.negative <= 1 ? analysis.probabilities.negative * 100 : analysis.probabilities.negative;
      const neu = analysis.probabilities.neutral <= 1 ? analysis.probabilities.neutral * 100 : analysis.probabilities.neutral;
      return { positive: pos, negative: neg, neutral: neu };
    }
    // High-fidelity reconstruction backup
    const conf = analysis.confidence || 70;
    if (analysis.sentiment === 'Positive') {
      return { positive: conf, negative: Math.max(2, (100 - conf) * 0.25), neutral: Math.max(2, (100 - conf) * 0.75) };
    } else if (analysis.sentiment === 'Negative') {
      return { positive: Math.max(2, (100 - conf) * 0.25), negative: conf, neutral: Math.max(2, (100 - conf) * 0.75) };
    } else {
      return { positive: Math.max(2, (100 - conf) * 0.5), negative: Math.max(2, (100 - conf) * 0.5), neutral: conf };
    }
  };

  return (
    <section id="live-news" className="scroll-mt-28 mb-8">
      <div className={`p-8 rounded-2xl border ${colors.border} ${colors.cardBg} transition-all duration-300 shadow-xl ${colors.glow}`}>
        
        {/* Panel Header */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/30" />
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Newspaper className="w-6 h-6 text-indigo-400" />
                Financial Sentiment & Signal Terminal
              </h2>
            </div>
            <p className="text-sm text-slate-400 mt-2">
              Analyze live headlines with our specialized models to extract sentiment logits and trading signals.
            </p>
          </div>

          {/* Model Engine Selector */}
          <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-lg w-full sm:w-auto">
              <button
                onClick={() => onEngineChange('finbert')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-bold tracking-tight px-5 py-2.5 rounded-lg transition-all duration-300 ${
                  activeEngine === 'finbert'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Brain className="w-4 h-4 text-yellow-400" />
                🥇 FinBERT Model
              </button>
              <button
                onClick={() => onEngineChange('gemini')}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-bold tracking-tight px-5 py-2.5 rounded-lg transition-all duration-300 ${
                  activeEngine === 'gemini'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Zap className="w-4 h-4 text-sky-400" />
                ♊ Gemini 3.5-Flash
              </button>
            </div>

            {/* Sentiment Filters */}
            <div className="flex items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 shadow-lg w-full sm:w-auto justify-between">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-500 px-3 flex items-center gap-2">
                <Filter className="w-3.5 h-3.5" /> Filter
              </span>
              <div className="flex gap-1">
                {(['All', 'Positive', 'Negative', 'Neutral'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSentimentFilter(filter)}
                    className={`text-xs uppercase font-extrabold tracking-wider px-3 py-2 rounded-lg transition-all duration-300 ${
                      sentimentFilter === filter
                        ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/35 shadow-lg'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Informative description banner for currently selected engine */}
        <div className="bg-gradient-to-r from-slate-950/50 to-slate-900/50 rounded-xl p-4 border border-slate-800/50 mb-8 flex items-start gap-3 shadow-lg">
          <Cpu className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            {activeEngine === 'finbert' ? (
              <p className="text-slate-300 leading-relaxed">
                <span className="text-yellow-400 font-bold">🥇 FinBERT Active:</span> Utilizing a custom NLP Transformer fine-tuned specifically for financial semantics. Computes raw sentiment logit probabilities to trigger precise mathematical <span className="font-bold text-emerald-400">Buy</span> / <span className="font-bold text-rose-400">Sell</span> trading signals.
              </p>
            ) : (
              <p className="text-slate-300 leading-relaxed">
                <span className="text-sky-400 font-bold">♊ Gemini 3.5-Flash Active:</span> Leveraging large language modeling to perform high-fidelity contextual reasoning, asset indexing, and macro trend correlation on complex news patterns.
              </p>
            )}
          </div>
        </div>

        {/* News Feed Grid */}
        <div className="space-y-4 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
          {isLoading && filteredNews.length === 0 ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-xs">Synchronizing Global News Terminals...</span>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No recent news stories found matching the selected "{sentimentFilter}" filter.
            </div>
          ) : (
            filteredNews.map((item) => {
              const currentProb = item.analysis ? getProbabilities(item.analysis) : null;
              const hasAnalysis = !!item.analysis;
              const isFinbertAnalysis = item.analysis?.engine?.includes('finbert');

              return (
                <div
                  key={item.id}
                  className="bg-slate-950/30 p-4 rounded-xl border border-slate-900 hover:border-slate-800 transition-all grid grid-cols-1 lg:grid-cols-3 gap-5"
                >
                  {/* Left Column: Headline details */}
                  <div className="lg:col-span-2 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-900 px-2.5 py-0.5 rounded-md border border-slate-800">
                          {item.source}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/5 px-2.5 py-0.5 rounded-md border border-indigo-500/10">
                          {item.region}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {item.datetime.toLocaleTimeString()}
                        </span>
                        {hasAnalysis && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                            isFinbertAnalysis 
                              ? 'bg-yellow-500/5 text-yellow-400 border-yellow-500/15'
                              : 'bg-sky-500/5 text-sky-400 border-sky-500/15'
                          }`}>
                            {isFinbertAnalysis ? '🥇 FinBERT' : '♊ Gemini'}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-slate-100 leading-snug hover:text-indigo-400 transition cursor-pointer">
                        {item.headline}
                      </h3>
                    </div>

                    {/* Affected assets tags */}
                    <div className="flex flex-wrap gap-1.5 mt-4">
                      {item.affected_assets.map((asset) => (
                        <span
                          key={asset}
                          className="text-[9px] font-bold font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-850"
                        >
                          {asset}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Multi-Engine AI Analysis Card */}
                  <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-900/60 flex flex-col justify-between relative overflow-hidden">
                    
                    {item.isAnalyzing ? (
                      <div className="h-full min-h-[110px] flex flex-col items-center justify-center gap-2.5 py-4">
                        <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin" />
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider animate-pulse">
                          {activeEngine === 'finbert' ? 'FinBERT Classifying...' : 'Gemini Analyzing...'}
                        </span>
                      </div>
                    ) : item.analysis ? (
                      <div className="space-y-3">
                        {/* Analysis Badge Header */}
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-indigo-400" /> Sentiment Result
                          </span>
                          <span
                            className={`text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded border ${
                              item.analysis.sentiment === 'Positive'
                                ? colors.positiveBg + ' ' + colors.positiveText
                                : item.analysis.sentiment === 'Negative'
                                ? colors.negativeBg + ' ' + colors.negativeText
                                : colors.neutralBg + ' ' + colors.neutralText
                            }`}
                          >
                            {item.analysis.sentiment} ({item.analysis.confidence}%)
                          </span>
                        </div>

                        {/* Sentiment Probabilities Spectrum Block (FinBERT Specific or Simulated) */}
                        {currentProb && (
                          <div className="space-y-1 bg-slate-950/40 p-2 rounded-lg border border-slate-900">
                            <div className="flex justify-between text-[9px] font-bold text-slate-400">
                              <span>Sentiment Logits:</span>
                              <span className="font-mono text-[8px] text-slate-500">
                                P:{currentProb.positive.toFixed(0)}% | N:{currentProb.negative.toFixed(0)}% | O:{currentProb.neutral.toFixed(0)}%
                              </span>
                            </div>
                            
                            {/* Visual stacked logit bar */}
                            <div className="h-2 w-full rounded overflow-hidden flex bg-slate-900">
                              <div 
                                style={{ width: `${currentProb.positive}%` }} 
                                className="bg-emerald-500 transition-all duration-300" 
                                title={`Positive: ${currentProb.positive.toFixed(1)}%`}
                              />
                              <div 
                                style={{ width: `${currentProb.neutral}%` }} 
                                className="bg-slate-600 transition-all duration-300" 
                                title={`Neutral: ${currentProb.neutral.toFixed(1)}%`}
                              />
                              <div 
                                style={{ width: `${currentProb.negative}%` }} 
                                className="bg-rose-500 transition-all duration-300" 
                                title={`Negative: ${currentProb.negative.toFixed(1)}%`}
                              />
                            </div>
                          </div>
                        )}

                        {/* Buy/Sell/Hold Signal Indicator */}
                        <div className={`p-2 rounded flex items-center justify-between border ${
                          item.analysis.signal === 'Buy'
                            ? 'bg-emerald-500/5 border-emerald-500/15'
                            : item.analysis.signal === 'Sell'
                            ? 'bg-rose-500/5 border-rose-500/15'
                            : 'bg-slate-900/60 border-slate-800'
                        }`}>
                          <span className="text-[10px] font-bold text-slate-300 flex items-center gap-1">
                            {item.analysis.signal === 'Buy' && <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />}
                            {item.analysis.signal === 'Sell' && <TrendingDown className="w-3.5 h-3.5 text-rose-400" />}
                            {item.analysis.signal === 'Hold' && <Gauge className="w-3.5 h-3.5 text-slate-400" />}
                            Trading Signal:
                          </span>
                          <span
                            className={`text-xs font-black px-2 py-0.5 rounded uppercase tracking-wider ${
                              item.analysis.signal === 'Buy'
                                ? colors.positiveText + ' animate-pulse'
                                : item.analysis.signal === 'Sell'
                                ? colors.negativeText
                                : colors.neutralText
                            }`}
                          >
                            {item.analysis.signal}
                          </span>
                        </div>

                        {/* Rationale text */}
                        <p className="text-[11px] text-slate-300 leading-snug italic">
                          "{item.analysis.rationale}"
                        </p>

                        {/* Option to re-analyze with alternate engine */}
                        <div className="pt-2 border-t border-slate-900 flex justify-end gap-1">
                          <button
                            onClick={() => onAnalyzeHeadline(item.id, isFinbertAnalysis ? 'gemini' : 'finbert')}
                            className="text-[9px] text-slate-400 hover:text-white transition-colors py-0.5 px-1.5 rounded bg-slate-900 hover:bg-slate-850 flex items-center gap-1"
                            title={`Re-analyze this news headline using ${isFinbertAnalysis ? 'Gemini 3.5-Flash' : 'FinBERT'}`}
                          >
                            <RefreshCw className="w-2.5 h-2.5" /> Analyze with {isFinbertAnalysis ? 'Gemini' : 'FinBERT'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center py-4 min-h-[110px]">
                        <p className="text-[10px] text-slate-500 text-center mb-3">
                          Sentiment evaluation pending for {activeEngine === 'finbert' ? 'FinBERT' : 'Gemini'}.
                        </p>
                        <button
                          onClick={() => onAnalyzeHeadline(item.id, activeEngine)}
                          className="w-full text-[10px] bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 font-bold py-2 px-3 rounded-md border border-indigo-500/25 transition flex items-center justify-center gap-1.5"
                        >
                          {activeEngine === 'finbert' ? (
                            <>
                              <Brain className="w-3.5 h-3.5 text-yellow-400" /> Analyze with FinBERT Model
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-sky-400" /> Analyze with Gemini 3.5-Flash
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

      </div>
    </section>
  );
}
