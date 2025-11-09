# WellWorld - Global Volunteering Platform

WellWorld is an interactive platform that connects volunteers with global opportunities while providing AI-powered recommendations and real-time collaboration features. The platform features an interactive 3D globe visualization, chat functionality, and smart opportunity matching powered by Google's Gemini AI.

## About the Project

**Inspiration.** I grew up watching neighbors coordinate disaster-response drives with little more than group chats and shared spreadsheets. WellWorld is my attempt to give grassroots organizers a global cockpit where compassion scales as gracefully as code.

**How we built it.** The system stitches together a React + Globe.gl front end, a FastAPI backend, Supabase auth/real-time plumbing, and Gemini-powered recommender flows. The recommendation system uses natural language processing to analyze opportunities based on key factors like time commitment, skill requirements, and potential impact, helping match volunteers with the most suitable opportunities.

**What I learned.** Bridging 3D geospatial rendering with conversational AI taught me a lot about streaming data contracts, optimistic UI patterns, and crafting prompt-safe middle layers so that model outputs stay human-trustworthy.

**Challenges.** Time zones, rate limits, and globe performance kept biting us; the biggest hurdle was smoothing latency so that cross-continent collaborators stayed in sync while Gemini suggestions arrived fast enough to feel like a teammate.

## Features

- **Interactive 3D Globe:** Visualize volunteering opportunities worldwide
- **Real-time Chat:** Collaborate with other volunteers in planning rooms
- **AI Assistant (WorldAI):** Get personalized volunteering recommendations
- **Opportunity Browser:** Browse and filter volunteering opportunities
- **Location-based Mapping:** See opportunities mapped to their geographic locations
- **Collaborative Planning:** Create and join planning rooms for group coordination

## Tech Stack

### Frontend
- React.js
- Globe.gl (Three.js-based 3D visualization)
- Supabase Client (Authentication & Real-time features)
- React Router (Navigation)
- Modern CSS (Flexbox & Grid layouts)

### Backend
- Python FastAPI
- Google Gemini AI
- Supabase (Database & Auth)
- Uvicorn (ASGI Server)

## Getting Started

### Prerequisites
- Node.js 18 or higher
- Python 3.8 or higher
- npm or yarn
- pip (Python package manager)

### Installation Steps

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment:**
   - On Windows:
     ```bash
     venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. **Install dependencies:**
   ```bash
   pip install -r ../requirements.txt
   ```
   Or if you're in the root directory:
   ```bash
   pip install -r requirements.txt
   ```

5. **Create a `.env` file in the `backend` directory:**
   ```bash
   # backend/.env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   
   You can get your Gemini API key from: https://makersuite.google.com/app/apikey

6. **Run the backend server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   
   Or from the root directory:
   ```bash
   uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Backend Server Details

- **Default URL:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs (Swagger UI)
- **Alternative Docs:** http://localhost:8000/redoc (ReDoc)

### Environment Variables

- `GEMINI_API_KEY` (required): Your Google Gemini API key
- `GEMINI_FAST_MODEL` (optional): Override the default model (default: `gemini-2.5-flash`)
- `FRONTEND_ORIGINS` (optional): Comma-separated list of allowed frontend origins (default: `http://localhost:3000`)

### Project Structure

```
├── backend/                 # Python FastAPI backend
│   ├── gemini/             # Gemini AI integration
│   ├── routers/            # API route handlers
│   ├── utils/              # Utility functions
│   └── main.py            # Main application entry
├── client/                 # React frontend
│   ├── public/            # Static files
│   └── src/
│       ├── components/    # React components
│       ├── pages/         # Page components
│       └── lib/           # Utility functions
└── requirements.txt       # Python dependencies
```

## API Documentation

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## Environment Variables

### Frontend (.env)
- `REACT_APP_SUPABASE_URL`: Your Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### Backend (.env)
- `GEMINI_API_KEY`: Your Google Gemini API key
- `GEMINI_FAST_MODEL` (optional): Override default Gemini model
- `FRONTEND_ORIGINS` (optional): Allowed frontend origins

## Development

### Running Tests
- Frontend: `cd client && npm test`
- Backend: `cd backend && pytest`

### Building for Production
- Frontend: `cd client && npm run build`
- Backend: Ensure production-ready WSGI server (e.g., Gunicorn)

### Troubleshooting

- **Import errors:** Make sure all dependencies are installed: `pip install -r requirements.txt`
- **GEMINI_API_KEY error:** Ensure your `.env` file exists in the `backend` directory and contains a valid API key
- **Port already in use:** Change the port with `--port 8001` or kill the process using port 8000
- **Frontend build issues:** Clear npm cache and node_modules: `rm -rf node_modules && npm install`
- **Supabase connection issues:** Verify environment variables and network connectivity

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Globe visualization powered by [Globe.gl](https://globe.gl)
- AI features powered by [Google Gemini](https://deepmind.google/technologies/gemini/)
- Real-time features powered by [Supabase](https://supabase.com)
