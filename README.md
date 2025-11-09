# GUH2025

## Backend Setup and Running

### Prerequisites
- Python 3.8 or higher
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

### Troubleshooting

- **Import errors:** Make sure all dependencies are installed: `pip install -r requirements.txt`
- **GEMINI_API_KEY error:** Ensure your `.env` file exists in the `backend` directory and contains a valid API key
- **Port already in use:** Change the port with `--port 8001` or kill the process using port 8000
