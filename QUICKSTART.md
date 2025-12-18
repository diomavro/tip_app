# Quick Start Guide

## What You Got

A complete full-stack tip distribution application with:

✅ **Frontend**: React + TypeScript with beautiful UI  
✅ **Backend**: Python FastAPI with REST API  
✅ **Database**: SQLite for data persistence  
✅ **Auto-calculation**: Share percentages and tip amounts  
✅ **Responsive Design**: Works on all devices  

## Getting Started (3 Steps)

### Option 1: Automatic (Easiest)

**On Mac/Linux:**
```bash
./start.sh
```

**On Windows:**
```
start.bat
```

### Option 2: Manual

**Step 1 - Install Dependencies:**
```bash
# Python dependencies
pip install -r requirements.txt

# Node.js dependencies
npm install
```

**Step 2 - Start Backend:**
```bash
python backend.py
```

**Step 3 - Start Frontend (in new terminal):**
```bash
npm run dev
```

## Access the App

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## How to Use

1. Enter the **total tips** for the week
2. Add employees and their **hours worked**
3. Watch the **share percentage** calculate automatically
4. Click **"Calculate & Save"** to compute tips and save to database
5. View **results** showing each employee's tip amount

## Project Files

```
tip-distribution-app/
├── backend.py              # Python FastAPI server
├── requirements.txt        # Python packages
├── package.json           # Node.js packages
├── start.sh              # Quick start (Mac/Linux)
├── start.bat             # Quick start (Windows)
├── README.md             # Full documentation
├── index.html           # HTML entry
├── vite.config.ts       # Build config
├── tailwind.config.js   # Styling config
├── tsconfig.json        # TypeScript config
└── src/
    ├── main.tsx              # React entry point
    ├── App.tsx               # Main app
    ├── TipDistribution.tsx   # Tip calculator
    └── index.css             # Global styles
```

## Example Usage

**Input:**
- Total Tips: $500
- Employee A: 40 hours
- Employee B: 30 hours
- Employee C: 20 hours

**Output:**
- Employee A: $222.22 (44.44%)
- Employee B: $166.67 (33.33%)
- Employee C: $111.11 (22.22%)

## Key Features

### Automatic Calculations
- Share percentages update as you type
- Real-time validation
- Error handling

### Database Storage
- Every calculation is saved
- SQLite database (tips.db)
- Query history via API

### Modern UI
- Clean, professional design
- Responsive layout
- Icons and visual feedback
- Success/error messages

## API Endpoints

### Calculate Tips
```bash
POST http://localhost:8000/calculate
```

### Save to Database
```bash
POST http://localhost:8000/save
```

### View History
```bash
GET http://localhost:8000/history?limit=10
```

### Delete Record
```bash
DELETE http://localhost:8000/history/{id}
```

## Troubleshooting

**Port already in use?**
- Change frontend port in `vite.config.ts`
- Change backend port in `backend.py`

**Dependencies not installing?**
- Update Node.js: https://nodejs.org/
- Update Python: https://python.org/

**CORS errors?**
- Make sure backend is running
- Check backend URL in `TipDistribution.tsx`

## Next Steps

1. ✅ Run the application
2. 📝 Test with sample data
3. 🎨 Customize the UI (colors, fonts, etc.)
4. 🚀 Deploy to production (see README.md)

## Need Help?

- Full documentation: See `README.md`
- API docs: http://localhost:8000/docs
- Test the API directly from the interactive docs

---

**Made with ❤️ using React, TypeScript, FastAPI, and SQLite**
