from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
from datetime import datetime
import json

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database setup
def init_db():
    conn = sqlite3.connect('tips.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tip_distributions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            week_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_tips REAL NOT NULL,
            total_hours REAL NOT NULL,
            employee_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Employees table to persist known employees and their latest role/multiplier
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            role TEXT,
            multiplier REAL,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

# Pydantic models
class Employee(BaseModel):
    name: str
    hours: float
    role: Optional[str] = None
    multiplier: Optional[float] = None

class TipCalculationRequest(BaseModel):
    total_tips: float
    employees: List[Employee]

class CalculationResult(BaseModel):
    employee_name: str
    hours: float
    share_percentage: float
    tip_amount: float

class SaveRequest(BaseModel):
    total_tips: float
    employees: List[Employee]
    results: List[CalculationResult]


def role_to_multiplier(role: str) -> float:
    if not role:
        return 0.8
    r = role.lower()
    if r == 'experienced waiter':
        return 1.0
    if r == 'waiter':
        return 0.8
    if r == 'kitchen':
        return 0.5
    if r == 'new':
        return 0.6
    return 0.8

@app.get("/")
def read_root():
    return {"message": "Tip Distribution API"}

@app.post("/calculate", response_model=List[CalculationResult])
def calculate_tips(request: TipCalculationRequest):
    """
    Calculate tip distribution based on hours worked
    """
    if request.total_tips <= 0:
        raise HTTPException(status_code=400, detail="Total tips must be greater than 0")
    
    if not request.employees:
        raise HTTPException(status_code=400, detail="At least one employee is required")
    
    # Calculate total hours
    total_hours = sum(emp.hours for emp in request.employees)
    
    if total_hours <= 0:
        raise HTTPException(status_code=400, detail="Total hours must be greater than 0")
    
    # Calculate distribution
    results = []
    for employee in request.employees:
        share_percentage = (employee.hours / total_hours) * 100
        tip_amount = (employee.hours / total_hours) * request.total_tips
        
        results.append(CalculationResult(
            employee_name=employee.name,
            hours=employee.hours,
            share_percentage=share_percentage,
            tip_amount=tip_amount
        ))
    
    return results

@app.post("/save")
def save_distribution(request: SaveRequest):
    """
    Save tip distribution to database
    """
    try:
        conn = sqlite3.connect('tips.db')
        cursor = conn.cursor()
        
        total_hours = sum(emp.hours for emp in request.employees)
        
        # Convert employee data and results to JSON
        employee_data = {
            "employees": [emp.model_dump() for emp in request.employees],
            "results": [result.model_dump() for result in request.results]
        }
        
        cursor.execute('''
            INSERT INTO tip_distributions (total_tips, total_hours, employee_data)
            VALUES (?, ?, ?)
        ''', (request.total_tips, total_hours, json.dumps(employee_data)))

        # Upsert employees table with latest role and multiplier
        for emp in request.employees:
            mult = emp.multiplier if emp.multiplier is not None else role_to_multiplier(emp.role or '')
            # Use SQLite UPSERT (requires UNIQUE constraint on name)
            cursor.execute('''
                INSERT INTO employees (name, role, multiplier, last_seen)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(name) DO UPDATE SET
                    role=excluded.role,
                    multiplier=excluded.multiplier,
                    last_seen=CURRENT_TIMESTAMP
            ''', (emp.name, emp.role, mult))
        
        conn.commit()
        record_id = cursor.lastrowid
        conn.close()
        
        return {
            "id": record_id,
            "message": "Tip distribution saved successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving to database: {str(e)}")

@app.get("/history")
def get_history(limit: int = 10):
    """
    Get history of tip distributions
    """
    try:
        conn = sqlite3.connect('tips.db')
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, week_date, total_tips, total_hours, employee_data, created_at
            FROM tip_distributions
            ORDER BY created_at DESC
            LIMIT ?
        ''', (limit,))
        
        rows = cursor.fetchall()
        conn.close()
        
        history = []
        for row in rows:
            history.append({
                "id": row[0],
                "week_date": row[1],
                "total_tips": row[2],
                "total_hours": row[3],
                "employee_data": json.loads(row[4]),
                "created_at": row[5]
            })
        
        return history
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")


@app.get("/employees")
def get_employees(limit: int = 50):
    """
    Return list of known employees ordered by last seen (most recent first).
    """
    try:
        conn = sqlite3.connect('tips.db')
        cursor = conn.cursor()
        cursor.execute('''
            SELECT name, role, multiplier, last_seen
            FROM employees
            ORDER BY last_seen DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        conn.close()

        out = []
        for r in rows:
            out.append({
                'name': r[0],
                'role': r[1],
                'multiplier': r[2],
                'last_seen': r[3]
            })
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving employees: {str(e)}")

@app.delete("/history/{record_id}")
def delete_record(record_id: int):
    """
    Delete a specific tip distribution record
    """
    try:
        conn = sqlite3.connect('tips.db')
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM tip_distributions WHERE id = ?', (record_id,))
        
        if cursor.rowcount == 0:
            conn.close()
            raise HTTPException(status_code=404, detail="Record not found")
        
        conn.commit()
        conn.close()
        
        return {"message": "Record deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting record: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
