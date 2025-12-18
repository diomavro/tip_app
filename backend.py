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


def compute_allocation(total_tips: float, employees: List[Employee], restaurant_share: float = 0.02, round_to: float = 5.0):
    """
    Compute allocation with role multipliers, add restaurant row with fixed share, round weekly amounts to `round_to`,
    and subtract any rounding overage from the restaurant row.

    Returns a list of dictionaries with keys: name, id (or 'restaurant'), hours, role, multiplier, points,
    prop (raw), weekly_raw, weekly_rounded, prop_after
    """
    total_tips_value = float(total_tips)

    # Compute multipliers and points for employees
    totals_with_points = []
    for emp in employees:
        mult = emp.multiplier if emp.multiplier is not None else role_to_multiplier(emp.role or '')
        points = (emp.hours or 0) * mult
        totals_with_points.append({
            'id': emp.name,
            'name': emp.name,
            'hours': emp.hours,
            'role': emp.role,
            'multiplier': mult,
            'points': points
        })

    total_employee_points = sum(x['points'] for x in totals_with_points)

    rows = []
    # If there are no employee points, everyone gets 0 and restaurant gets everything
    if total_employee_points <= 0 or total_tips_value <= 0:
        # employees with zero allocations
        for x in totals_with_points:
            rows.append({**x, 'prop': 0.0, 'weekly_raw': 0.0, 'weekly_rounded': 0.0, 'prop_after': 0.0})
        rows.append({'id': 'restaurant', 'name': 'Restaurant', 'hours': 0, 'role': 'restaurant', 'multiplier': 0.0, 'points': 0.0, 'prop': restaurant_share, 'weekly_raw': total_tips_value, 'weekly_rounded': total_tips_value, 'prop_after': 1.0 if total_tips_value > 0 else 0.0})
        return rows

    # Scale employee proportions so restaurant gets `restaurant_share` of the total (spreadsheet pattern)
    for x in totals_with_points:
        raw_prop_points = x['points'] / total_employee_points if total_employee_points > 0 else 0.0
        prop = raw_prop_points * (1.0 - restaurant_share)
        weekly_raw = prop * total_tips_value
        weekly_rounded = (round(weekly_raw / round_to) * round_to) if round_to > 0 else weekly_raw
        rows.append({**x, 'prop': prop, 'weekly_raw': weekly_raw, 'weekly_rounded': weekly_rounded})

    # Sum rounded employee payouts and give the remainder to the restaurant
    sum_employees_rounded = sum(r['weekly_rounded'] for r in rows)
    restaurant_amount = max(0.0, total_tips_value - sum_employees_rounded)

    # Restaurant raw share (before rounding) is restaurant_share; weekly_raw for restaurant based on that
    restaurant_weekly_raw = restaurant_share * total_tips_value
    # Restaurant receives the remainder after employee rounding (not additionally rounded)
    rows.append({'id': 'restaurant', 'name': 'Restaurant', 'hours': 0, 'role': 'restaurant', 'multiplier': 0.0, 'points': 0.0, 'prop': restaurant_share, 'weekly_raw': restaurant_weekly_raw, 'weekly_rounded': restaurant_amount})

    # compute prop_after (based on rounded amounts)
    for r in rows:
        r['prop_after'] = (r['weekly_rounded'] / total_tips_value) if total_tips_value > 0 else 0.0

    return rows

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
    
    # Use compute_allocation to determine rounded weekly payouts and proportions
    rows = compute_allocation(request.total_tips, request.employees)

    results = []
    # map only real employees (exclude restaurant row) into the response model
    for r in rows:
        if r.get('id') == 'restaurant':
            continue
        results.append(CalculationResult(
            employee_name=r.get('name'),
            hours=float(r.get('hours') or 0),
            share_percentage=float(r.get('prop_after', 0.0) * 100),
            tip_amount=float(r.get('weekly_rounded', 0.0))
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
