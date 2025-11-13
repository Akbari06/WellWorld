# 🌍 WellWorld

WellWorld is an interactive platform that connects volunteers with global opportunities while providing AI-powered recommendations and real-time collaboration features. The platform features an interactive 3D globe visualization, chat functionality, and smart opportunity matching powered by Google's Gemini AI.

Achieved 🥇 for Google Dev. Group and 🥉 for Booking.com tracks.

## About the Project

**Inspiration.** I grew up watching neighbors coordinate disaster-response drives with little more than group chats and shared spreadsheets. WellWorld is my attempt to give grassroots organizers a global cockpit where compassion scales as gracefully as code.

**How we built it.** The system stitches together a React + Globe.gl front end, a FastAPI backend, Supabase auth/real-time plumbing, and Gemini-powered recommender flows. The recommendation system uses natural language processing to analyze opportunities based on key factors like time commitment, skill requirements, and potential impact, helping match volunteers with the most suitable opportunities.

**What I learned.** Bridging 3D geospatial rendering with conversational AI taught me a lot about streaming data contracts, optimistic UI patterns, and crafting prompt-safe middle layers so that model outputs stay human-trustworthy.

**Challenges.** Time zones, rate limits, and globe performance kept biting us; the biggest hurdle was smoothing latency so that cross-continent collaborators stayed in sync while Gemini suggestions arrived fast enough to feel like a teammate.

## ✨ Key Features

🌐 **Interactive 3D Globe:** Visualize volunteering opportunities worldwide with an immersive Three.js-based globe

💬 **Real-time Chat:** Collaborate with other volunteers in planning rooms with live messaging

🤖 **AI Assistant (WorldAI):** Get personalized volunteering recommendations powered by Google Gemini

🔍 **Opportunity Browser:** Browse and filter volunteering opportunities by location, type, and requirements

📍 **Location-based Mapping:** See opportunities mapped to their geographic locations on the 3D globe

👥 **Collaborative Planning:** Create and join planning rooms for group coordination (up to 4 people per room)

✈️ **Flight Route Visualization:** View flight routes from your nearest airport to volunteering destinations

## 🛠️ Tech Stack

**Frontend:**
- React.js with React Router
- Globe.gl (Three.js-based 3D visualization)
- Supabase Client (Authentication & Real-time features)
- Modern CSS (Flexbox & Grid layouts)

**Backend:**
- Python FastAPI
- Google Gemini AI (for recommendations and analysis)
- Google Maps API (for airport finding and flight routes)
- Supabase (Database & Auth)
- Uvicorn (ASGI Server)

## 🧠 How It Works

1. **User Authentication:** Users sign up/login via Supabase authentication
2. **Room Creation:** Users create or join planning rooms with unique 6-digit codes
3. **Country Selection:** Master user selects a country on the interactive 3D globe
4. **Opportunity Discovery:** System fetches volunteering opportunities from Idealist.org for the selected country
5. **AI Recommendations:** Gemini AI analyzes opportunities and provides personalized recommendations
6. **Collaborative Voting:** Room participants vote on opportunities they're interested in
7. **Final Selection:** System determines the final destination based on group consensus
8. **Route Planning:** Flight routes are calculated from user's location to the selected opportunity

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or later
- Python 3.8 or higher
- npm or yarn
- pip (Python package manager)
- API keys for:
  - Google Gemini
  - Google Maps
  - Supabase

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/wellworld.git
   cd wellworld
   ```

2. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

3. **Set up Python backend**
   ```bash
   cd backend
   python -m venv venv
   
   # On macOS/Linux:
   source venv/bin/activate
   
   # On Windows:
   venv\Scripts\activate
   
   pip install -r ../requirements.txt
   cd ..
   ```

4. **Create environment files**
   
   Create `backend/.env`:
   ```bash
   GEMINI_API_KEY=your-gemini-api-key
   GMAPS_API_KEY=your-google-maps-api-key
   ```
   
   Create `client/.env`:
   ```bash
   REACT_APP_SUPABASE_URL=your-supabase-url
   REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
   
   Get your API keys from:
   - Gemini API key: https://makersuite.google.com/app/apikey
   - Google Maps API key: https://console.cloud.google.com/google/maps-apis/credentials
   - Supabase: https://supabase.com

5. **Start the development servers**
   
   Backend (from root directory):
   ```bash
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```
   
   Frontend (in a new terminal):
   ```bash
   cd client
   npm start
   ```

6. **Open your browser**
   
   - Frontend: http://localhost:3000
   - Backend API Docs: http://localhost:8000/docs

## 📁 Project Structure

```
├── backend/                 # Python FastAPI backend
│   ├── routers/            # API route handlers
│   │   ├── gemini/         # Gemini AI integration
│   │   ├── gmap/           # Google Maps integration
│   │   └── volunteering/   # Volunteering opportunity routes
│   ├── utils/              # Utility functions
│   └── main.py            # Main application entry
├── client/                 # React frontend
│   ├── public/            # Static files
│   └── src/
│       ├── components/    # React components (Globe, Chat, etc.)
│       ├── pages/         # Page components
│       └── lib/           # Utility functions
└── requirements.txt       # Python dependencies
```

## 🔧 Environment Variables

### Backend (`backend/.env`)
- `GEMINI_API_KEY` (required): Your Google Gemini API key
- `GMAPS_API_KEY` (required): Your Google Maps API key
- `GEMINI_FAST_MODEL` (optional): Override default model (default: `gemini-2.5-flash`)
- `FRONTEND_ORIGINS` (optional): Comma-separated list of allowed origins (default: `http://localhost:3000`)

### Frontend (`client/.env`)
- `REACT_APP_SUPABASE_URL` (required): Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` (required): Your Supabase anonymous key

## 📚 API Documentation

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## 🐛 Troubleshooting

- **Import errors:** Make sure all dependencies are installed: `pip install -r requirements.txt`
- **API key errors:** Ensure your `.env` files exist and contain valid API keys
- **Port already in use:** Change the port with `--port 8001` or kill the process using port 8000
- **Frontend build issues:** Clear npm cache: `rm -rf node_modules && npm install`
- **Supabase connection issues:** Verify environment variables and network connectivity

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Globe visualization powered by [Globe.gl](https://globe.gl)
- AI features powered by [Google Gemini](https://deepmind.google/technologies/gemini/)
- Real-time features powered by [Supabase](https://supabase.com)
- Volunteering opportunities from [Idealist.org](https://www.idealist.org)
