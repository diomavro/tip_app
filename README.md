# Tip Distribution Application

A full-stack application for calculating and tracking tip distribution among employees based on hours worked.

## Features

- 📊 **Spreadsheet Interface**: Easy-to-use table for entering employee hours
- 💰 **Automatic Calculation**: Calculates tip distribution based on hours worked
- 💾 **Database Storage**: Saves all calculations to SQLite database
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean interface with Tailwind CSS

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Lucide React (icons)

### Backend
- Python 3.8+
- FastAPI (web framework)
- SQLite (database)
- Pydantic (data validation)

## Project Structure

```
.
├── backend.py              # FastAPI backend server
├── requirements.txt        # Python dependencies
├── package.json           # Node.js dependencies
├── index.html            # HTML entry point
├── vite.config.ts        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript configuration
└── src/
    ├── main.tsx          # React entry point
    ├── App.tsx           # Main App component
    ├── TipDistribution.tsx  # Tip calculator component
    └── index.css         # Global styles
```

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- Python 3.8 or higher
- npm or yarn

### Backend Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Start the FastAPI backend:
```bash
python backend.py
```

The backend will start at `http://localhost:8000`

### Frontend Setup

1. Install Node.js dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will start at `http://localhost:3000`

## Usage

1. **Enter Total Tips**: Input the total tips collected for the week
2. **Add Employees**: Click "Add Employee" to add more rows
3. **Enter Hours**: Fill in each employee's name and hours worked
4. **View Share**: The share percentage is calculated automatically as you type
5. **Calculate**: Click "Calculate & Save" to compute tip amounts and save to database
6. **View Results**: See each employee's tip amount based on their hours

## API Endpoints

### POST /calculate
Calculate tip distribution without saving to database.

**Request Body:**
```json
{
  "total_tips": 500.00,
  "employees": [
    {"name": "John Doe", "hours": 40},
    {"name": "Jane Smith", "hours": 30}
  ]
}
```

**Response:**
```json
[
  {
    "employee_name": "John Doe",
    "hours": 40,
    "share_percentage": 57.14,
    "tip_amount": 285.71
  },
  {
    "employee_name": "Jane Smith",
    "hours": 30,
    "share_percentage": 42.86,
    "tip_amount": 214.29
  }
]
```

### POST /save
Save tip distribution to database.

**Request Body:**
```json
{
  "total_tips": 500.00,
  "employees": [...],
  "results": [...]
}
```

### GET /history
Retrieve history of tip distributions.

**Query Parameters:**
- `limit` (optional): Number of records to retrieve (default: 10)

### DELETE /history/{record_id}
Delete a specific tip distribution record.

## Database Schema

The application uses SQLite with the following schema:

```sql
CREATE TABLE tip_distributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_tips REAL NOT NULL,
    total_hours REAL NOT NULL,
    employee_data TEXT NOT NULL,  -- JSON string
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Building for Production

### Frontend
```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

### Backend
For production deployment, consider using:
- Gunicorn or Uvicorn with multiple workers
- Environment variables for configuration
- PostgreSQL instead of SQLite for better concurrency
- HTTPS/SSL certificates

## Development

### Frontend Development
- Hot Module Replacement (HMR) enabled
- TypeScript type checking
- ESLint for code quality

### Backend Development
- FastAPI automatic API documentation at `/docs`
- CORS enabled for local development
- SQLite database (`tips.db`) created automatically

## Troubleshooting

### Port Already in Use
If port 3000 or 8000 is already in use:
- Frontend: Change port in `vite.config.ts`
- Backend: Change port in `backend.py` (last line)

### CORS Issues
Ensure the backend CORS middleware includes your frontend URL:
```python
allow_origins=["http://localhost:3000"]
```

### Database Errors
Delete `tips.db` and restart the backend to recreate the database.

## Future Enhancements

- [ ] User authentication
- [ ] Multiple week tracking
- [ ] Export to CSV/PDF
- [ ] Email notifications
- [ ] Advanced reporting
- [ ] Mobile app version

## License

MIT License

## Support

For issues or questions, please open an issue on the repository.
