<div align="center">

# 🌍 Global Markets Command Center

**AI-Powered Real-Time Financial Intelligence Platform**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18.0-61DAFB?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

A sophisticated financial dashboard that combines real-time market data with AI-powered sentiment analysis and trading signals. Monitor global equities, cryptocurrencies, commodities, and news with advanced machine learning insights.

</div>

## ✨ Features

### 📊 Real-Time Market Data
- **US Equities**: Live S&P 500, Nasdaq 100 constituents with price tracking
- **Cryptocurrencies**: Top digital assets with Fear & Greed momentum index
- **Commodities**: Gold (XAU) and Silver (XAG) spot prices with INR conversion
- **Indian Equity**: NIFTY 50 benchmark tracking
- **Live Ticker Tape**: Scrolling marquee of all tracked assets

### 🤖 AI-Powered Analysis
- **FinBERT Integration**: Financial NLP transformer for sentiment analysis
- **Gemini LLM**: Advanced contextual reasoning for market signals
- **Multi-Engine Support**: Switch between AI models for different insights
- **Scenario Simulator**: Test hypothetical market events and predict impacts

### 📰 News & Signals
- **Live News Feed**: Real-time financial headlines from multiple sources
- **Sentiment Analysis**: AI-powered sentiment classification (Positive/Negative/Neutral)
- **Trading Signals**: Buy/Sell/Hold recommendations with confidence scores
- **Signal Dashboard**: Visual summary of all AI recommendations

### 🎨 Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark Theme**: Eye-friendly interface with multiple theme options
- **Real-Time Clocks**: Live market hours for NY and Mumbai
- **Smooth Animations**: Fluid transitions and hover effects

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Khatri-369/AI-TRADING.git
   cd AI-TRADING
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API Keys**
   
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   FINNHUB_API_KEY=your_finnhub_api_key_here
   GOLDAPI_KEY=your_goldapi_key_here
   ```

   **Optional API Keys** (for enhanced functionality):
   - **Finnhub API**: Get free key at [finnhub.io](https://finnhub.io/) for live US stocks and news
   - **GoldAPI.io**: Get free key at [goldapi.io](https://www.goldapi.io/) for real-time gold/silver prices
   - **Gemini API**: Required for AI signal analysis

4. **Run the application**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
global-markets-command-center/
├── src/
│   ├── components/          # React components
│   │   ├── Header.tsx      # Navigation and branding
│   │   ├── TickerTape.tsx  # Scrolling price marquee
│   │   ├── USStockPanel.tsx    # US equity market panel
│   │   ├── CryptoPanel.tsx     # Cryptocurrency panel
│   │   ├── CommoditiesPanel.tsx # Gold/Silver panel
│   │   ├── NewsSignalFeed.tsx  # News and AI signals
│   │   ├── SettingsPanel.tsx   # API configuration
│   │   └── ScenarioSimulator.tsx # Market scenario testing
│   ├── utils/
│   │   └── themes.ts       # Theme configurations
│   ├── types/
│   │   └── market.ts       # TypeScript type definitions
│   ├── App.tsx             # Main application component
│   └── main.tsx            # Application entry point
├── server.ts               # Express backend server
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## 🔧 Configuration

### API Keys Setup

The application supports both simulated data (default) and live data with API keys:

**Simulated Mode** (No API keys required):
- All market data is simulated for demonstration
- AI signals use fallback logic

**Live Mode** (API keys required):
- Configure keys in the Settings panel or `.env` file
- Real-time data from Finnhub, GoldAPI, and CoinGecko
- Full AI analysis capabilities with Gemini

### Theme Customization

Switch between multiple themes using the theme selector in the header:
- **Cyber Dark**: Default dark theme with indigo accents
- **Midnight Blue**: Deep blue tones
- **Forest Green**: Nature-inspired dark theme
- **Royal Purple**: Purple gradient theme

## 🎯 Usage Guide

### Monitoring Markets
1. **Overview Tab**: View all market vital signs at a glance
2. **Global Equities**: Detailed US stock analysis with AI ratings
3. **Spot Commodities**: Gold and silver prices with INR conversion
4. **Digital Assets**: Crypto prices with Fear & Greed index
5. **AI Signals & News**: News feed with sentiment analysis

### AI Signal Analysis
1. Navigate to any market panel
2. Click "Run AI Analysis" button
3. View sentiment, confidence score, and rationale
4. Check Signal Summary Dashboard for overall recommendations

### Scenario Testing
1. Go to Scenario Simulator section
2. Choose a preset scenario or write your own headline
3. Select AI engine (FinBERT or Gemini)
4. Run simulation to see predicted market impacts
5. Inject shockwave to test on active dashboard

## 🔒 Security

- **API Keys**: Stored only in React component state, never persisted
- **No Data Storage**: All data remains in memory during session
- **Secure Communication**: HTTPS for all external API calls
- **Privacy First**: No user tracking or analytics

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React icons
- **Backend**: Express.js (for API proxy)
- **AI/ML**: 
  - Google Gemini API for LLM analysis
  - FinBERT for financial sentiment analysis
- **Data Sources**:
  - Finnhub (US stocks, news)
  - CoinGecko (crypto prices)
  - GoldAPI.io (commodities)
  - ExchangeRate.host (currency conversion)

## 📈 Data Sources

- **US Equities**: Finnhub API (S&P 500, Nasdaq 100)
- **Cryptocurrencies**: CoinGecko API (top 50 coins)
- **Commodities**: GoldAPI.io (XAU, XAG spot prices)
- **News**: Finnhub News API (financial headlines)
- **Currency**: ExchangeRate.host (USD to INR conversion)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Google Gemini** for AI capabilities
- **Finnhub** for market data APIs
- **CoinGecko** for cryptocurrency data
- **GoldAPI.io** for commodities pricing
- **Tailwind CSS** for the beautiful UI framework

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact: [khatri-369](https://github.com/Khatri-369)

---

<div align="center">

**Built with ❤️ for traders and financial enthusiasts**

⭐ Star this repo if it helped you!

</div>

