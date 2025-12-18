import React, { useState } from 'react';
import { Trash2, Plus, DollarSign } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  // `hours` kept for compatibility but weekly hours are stored in `hoursGrid`
  hours: number;
  // optional employee type for UI
  type?: string;
}

interface CalculationResult {
  employee_name: string;
  hours: number;
  share_percentage: number;
  tip_amount: number;
}

const TipDistribution: React.FC = () => {
  const [totalTips, setTotalTips] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([
    { id: '1', name: '', hours: 0 }
  ]);
  // hoursGrid[employeeId][dateString] = hours for that day
  const [hoursGrid, setHoursGrid] = useState<Record<string, Record<string, number>>>({});
  // selectedDate will be used to compute the week (start from Monday)
  const [weekStart, setWeekStart] = useState<string>(() => {
    const d = new Date();
    // find Monday of current week
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // make Monday the start
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    return monday.toISOString().slice(0, 10);
  });
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string>('');
  const [restaurantShare, setRestaurantShare] = useState<number>(0.02);

  // Load persisted employees (name + type) from localStorage on mount
  React.useEffect(() => {
    // Try to fetch last-known employees from the backend first. If that fails, fall back to localStorage.
    let mounted = true;
    fetch('http://localhost:8000/employees')
      .then(res => {
        if (!res.ok) throw new Error('no employees');
        return res.json();
      })
      .then((data: any[]) => {
        if (!mounted) return;
        if (Array.isArray(data) && data.length > 0) {
          // Map to local Employee shape and assign stable ids
          const mapped = data.map((d, idx) => ({ id: (idx + 1).toString(), name: d.name || '', hours: 0, type: d.role || 'waiter' } as Employee));
          setEmployees(mapped);
          return;
        }
        // fallthrough to localStorage below
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem('td_employees_v1');
          if (raw) {
            const parsed = JSON.parse(raw) as Employee[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setEmployees(parsed.map(p => ({ ...p })));
            }
          }
        } catch (e) {
          // ignore
        }
      });
    return () => { mounted = false; };
  }, []);

  // Persist employees whenever they change
  React.useEffect(() => {
    try {
      localStorage.setItem('td_employees_v1', JSON.stringify(employees));
    } catch (e) {}
  }, [employees]);

  const addEmployee = () => {
    const newId = (Math.max(...employees.map(e => parseInt(e.id)), 0) + 1).toString();
    setEmployees([...employees, { id: newId, name: '', hours: 0, type: 'waiter' }]);
    setHoursGrid(prev => ({ ...prev, [newId]: {} }));
  };

  const removeEmployee = (id: string) => {
    if (employees.length > 1) {
      setEmployees(employees.filter(e => e.id !== id));
      setHoursGrid(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  const updateEmployee = (id: string, field: 'name' | 'hours' | 'type', value: string | number) => {
    setEmployees(employees.map(e => 
      e.id === id ? { ...e, [field]: value } : e
    ));
  };

  // Ensure hoursGrid has entries when employees or weekStart changes
  React.useEffect(() => {
    setHoursGrid(prev => {
      const next = { ...prev } as Record<string, Record<string, number>>;
      const dates = getWeekDates(weekStart);
      employees.forEach(emp => {
        if (!next[emp.id]) next[emp.id] = {};
        dates.forEach(d => {
          if (typeof next[emp.id][d] !== 'number') next[emp.id][d] = 0;
        });
      });
      // remove keys for removed employees
      Object.keys(next).forEach(k => {
        if (!employees.find(e => e.id === k)) delete next[k];
      });
      return next;
    });
  }, [employees, weekStart]);

  const updateHours = (employeeId: string, dateStr: string, value: number) => {
    setHoursGrid(prev => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {}),
        [dateStr]: value,
      }
    }));
  };

  function getWeekDates(startIso: string) {
    const start = new Date(startIso + 'T00:00:00');
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  const calculateTips = async () => {
    setError('');
    setIsSaved(false);
    
    // Validation
    if (!totalTips || parseFloat(totalTips) <= 0) {
      setError('Please enter a valid total tips amount');
      return;
    }

    // derive total hours per employee from hoursGrid
    const employeesWithTotals = employees.map(e => {
      const perDay = hoursGrid[e.id] || {};
      const total = Object.values(perDay).reduce((s, v) => s + (v || 0), 0);
      return { id: e.id, name: e.name, totalHours: total, type: e.type };
    });

    const validEmployees = employeesWithTotals.filter(e => e.name && e.totalHours > 0);
    if (validEmployees.length === 0) {
      setError('Please add at least one employee with hours worked');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_tips: parseFloat(totalTips),
          employees: validEmployees.map(e => ({ name: e.name, hours: e.totalHours, role: e.type }))
        })
      });
      if (!response.ok) throw new Error('Failed to calculate tips');
      const data: CalculationResult[] = await response.json();
      setResults(data);

      // Save to database
      const saveResponse = await fetch('http://localhost:8000/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_tips: parseFloat(totalTips),
          employees: validEmployees.map(e => ({ name: e.name, hours: e.totalHours, role: e.type })),
          results: data
        })
      });
      if (saveResponse.ok) setIsSaved(true);
    } catch (err) {
      setError('Error calculating or saving tips: ' + (err as Error).message);
    }
  };

  // total hours across the whole grid
  const totalHours = Object.values(hoursGrid).reduce((sumEmp, perDay) => {
    return sumEmp + Object.values(perDay).reduce((s, v) => s + (v || 0), 0);
  }, 0);

  // helper to compute per-employee totals for the current week
  const employeeTotals = employees.map(emp => {
    const total = getWeekDates(weekStart).reduce((s, d) => s + ((hoursGrid[emp.id] && hoursGrid[emp.id][d]) || 0), 0);
    return { id: emp.id, name: emp.name || 'Unnamed', total, type: emp.type || 'waiter' };
  });

  // approx fraction helper (small denominators, good for display like 1/3)
  function gcd(a: number, b: number) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { const t = b; b = a % b; a = t; }
    return a;
  }

  function approxFraction(x: number, maxDen = 20) {
    if (!isFinite(x) || x <= 0) return [0, 1];
    let best = { n: 0, d: 1, err: 1 };
    for (let d = 1; d <= maxDen; d++) {
      const n = Math.round(x * d);
      const err = Math.abs(x - (n / d));
      if (err < best.err) best = { n, d, err };
    }
    if (best.n === 0) return [0, 1];
    const g = gcd(best.n, best.d);
    return [best.n / g, best.d / g];
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-100 mb-6 flex items-center gap-2">
            <DollarSign className="text-green-600" />
            Tip Distribution Calculator
          </h1>

          {error && (
            <div className="bg-red-900 border border-red-700 text-red-300 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {isSaved && (
            <div className="bg-green-900 border border-green-700 text-green-300 px-4 py-3 rounded mb-4">
              Successfully saved to database!
            </div>
          )}

          {/* Total Tips Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Total Tips for the Week ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={totalTips}
              onChange={(e) => setTotalTips(e.target.value)}
              className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-700 text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Enter total tips"
            />
          </div>

          <div className="mb-4 text-sm text-gray-300">
            Total hours for selected week: <span className="font-medium text-gray-100">{totalHours.toFixed(2)} hrs</span>
          </div>

          {/* Weekly Hours Grid */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-100">Weekly Hours</h2>
                <label className="text-sm text-gray-300">Week start (Monday):</label>
                <input
                  type="date"
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  className="px-2 py-1 border border-gray-700 rounded bg-gray-700 text-gray-100"
                />
              </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={addEmployee}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    <Plus size={20} />
                    Add Employee
                  </button>

                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-300">Restaurant %</label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.1}
                      value={(restaurantShare * 100).toFixed(1)}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) setRestaurantShare(Math.max(0, v) / 100);
                      }}
                      className="w-20 px-2 py-1 border border-gray-700 rounded bg-gray-700 text-gray-100 text-right"
                    />
                    <button
                      onClick={() => setRestaurantShare(0.03)}
                      className="px-2 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm"
                      title="Set restaurant share to 3%"
                    >
                      Set 3%
                    </button>
                  </div>
                </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-gray-100">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="px-3 py-2 text-left text-sm font-semibold text-gray-200">Employee</th>
                    {getWeekDates(weekStart).map(dateStr => {
                      const display = new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                      return (
                        <th key={dateStr} className="px-3 py-2 text-center border-l text-sm font-medium text-gray-200">{display}</th>
                      );
                    })}
                    <th className="px-3 py-2 text-center border-l text-sm font-medium text-gray-200">Weekly Total</th>
                  </tr>
                </thead>

                <tbody>
                  {employees.map(emp => (
                    <tr key={emp.id} className="border-b hover:bg-gray-700">
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={emp.name}
                            onChange={(e) => updateEmployee(emp.id, 'name', e.target.value)}
                            placeholder="Name"
                            className="w-36 text-sm px-2 py-1 border border-gray-700 rounded bg-gray-700 text-gray-100"
                          />
                          <button
                            onClick={() => removeEmployee(emp.id)}
                            disabled={employees.length === 1}
                            className={`p-1 rounded hover:bg-red-100 transition ${employees.length === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Remove employee"
                          >
                            <Trash2 size={14} className="text-red-600" />
                          </button>
                        </div>
                      </td>

                      {getWeekDates(weekStart).map(dateStr => (
                        <td key={dateStr} className="px-3 py-2 text-center border-l">
                          <input
                            type="number"
                            step="1"
                            min={0}
                            value={(hoursGrid[emp.id] && hoursGrid[emp.id][dateStr]) ?? 0}
                            onChange={(e) => updateHours(emp.id, dateStr, parseFloat(e.target.value) || 0)}
                            className="w-20 mx-auto px-2 py-1 border border-gray-700 rounded bg-gray-700 text-gray-100 text-center"
                          />
                        </td>
                      ))}

                      <td className="px-3 py-2 text-center border-l font-semibold">
                        {getWeekDates(weekStart).reduce((s, d) => s + ((hoursGrid[emp.id] && hoursGrid[emp.id][d]) || 0), 0).toFixed(2)} hrs
                      </td>
                      <td className="px-3 py-2 text-center border-l">
                        <select
                          value={emp.type || 'waiter'}
                          onChange={(e) => updateEmployee(emp.id, 'type', e.target.value)}
                          className="px-2 py-1 border border-gray-700 rounded bg-gray-700 text-gray-100"
                        >
                          <option value="experienced waiter">experienced waiter</option>
                          <option value="waiter">waiter</option>
                          <option value="kitchen">kitchen</option>
                          <option value="new">new</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-gray-700 font-semibold">
                    <td className="px-3 py-2 text-gray-200">Daily Total</td>
                    {getWeekDates(weekStart).map(dateStr => {
                      const colTotal = employees.reduce((s, e) => s + ((hoursGrid[e.id] && hoursGrid[e.id][dateStr]) || 0), 0);
                      return (
                        <td key={dateStr} className="px-3 py-2 text-center border-l text-gray-200">{colTotal.toFixed(2)} hrs</td>
                      );
                    })}
                    <td className="px-3 py-2 text-center border-l text-gray-200">{totalHours.toFixed(2)} hrs</td>
                    <td className="px-3 py-2 text-center border-l text-gray-200">&nbsp;</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Calculate Button */}
          <button
            onClick={calculateTips}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition text-lg"
          >
            Calculate & Save
          </button>

          {/* Live-updating distribution table */}
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">Live Distribution</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-3 py-2 text-gray-200">Employee</th>
                    <th className="px-3 py-2 text-center text-gray-200">Hours</th>
                    <th className="px-3 py-2 text-center text-gray-200">Role Multiplier</th>
                    <th className="px-3 py-2 text-center text-gray-200">Points</th>
                    <th className="px-3 py-2 text-center text-gray-200">Tips before Rounding</th>
                    <th className="px-3 py-2 text-center text-gray-200">Proportion of Points</th>
                    <th className="px-3 py-2 text-center text-gray-200">Proportion after Rounding</th>
                    <th className="px-3 py-2 text-center text-gray-200">Visual</th>
                    <th className="px-3 py-2 text-center text-gray-200">Weekly Tip</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // multiplier mapping: experienced waiter=1.0, waiter=0.8, kitchen=0.5, new=0.6 (assumption)
                    const getMultiplier = (t: string) => {
                      switch ((t || '').toLowerCase()) {
                        case 'experienced waiter': return 1.0;
                        case 'waiter': return 0.8;
                        case 'kitchen': return 0.5;
                        case 'new': return 0.6;
                        default: return 0.8;
                      }
                    };

                    const totalsWithPoints = employeeTotals.map(emp => {
                      const mult = getMultiplier(emp.type);
                      const points = emp.total * mult;
                      return { ...emp, mult, points };
                    });

                    const totalEmployeePoints = totalsWithPoints.reduce((s, e) => s + e.points, 0);

                    // use `restaurantShare` from component state (editable by the user)
                    const totalTipsValue = parseFloat(totalTips) || 0;

                    // For each employee: scaled proportion = (points / totalEmployeePoints) * (1 - restaurantShare)
                    const employeeRows = totalsWithPoints.map(emp => {
                      const rawPropPoints = totalEmployeePoints > 0 ? (emp.points / totalEmployeePoints) : 0;
                      const prop = rawPropPoints * (1 - restaurantShare);
                      const weeklyRaw = prop * totalTipsValue;
                      const weeklyRounded = Math.round(weeklyRaw / 5) * 5;
                      return { emp, rawPropPoints, prop, weeklyRaw, weeklyRounded };
                    });

                    const sumEmployeesRounded = employeeRows.reduce((s, r) => s + r.weeklyRounded, 0);
                    // restaurantAmount may be negative if rounding caused over-distribution; show that to the user
                    const restaurantAmount = totalTipsValue - sumEmployeesRounded;

                    const restaurantRow = { emp: { id: 'restaurant', name: 'Restaurant', total: 0, type: 'restaurant', mult: 0, points: 0 }, rawPropPoints: 0, prop: restaurantShare, weeklyRaw: restaurantShare * totalTipsValue, weeklyRounded: restaurantAmount };

                    const finalRows = [...employeeRows, restaurantRow];

                    return finalRows.map(r => {
                      const emp = r.emp;
                      const prop = r.prop;
                      const [n, d] = approxFraction(prop, 20);
                      const frac = prop === 0 ? '0' : `${n}/${d}`;
                      const weeklyRounded = r.weeklyRounded;
                      const weeklyRaw = r.weeklyRaw ?? 0;
                      const propAfter = totalTipsValue > 0 ? (weeklyRounded / totalTipsValue) : 0; // proportion after rounding
                      return (
                        <tr key={emp.id} className="border-b border-gray-700">
                          <td className="px-3 py-2">{emp.name} <span className="text-xs text-gray-400">{emp.type && emp.type !== 'restaurant' ? `(${emp.type})` : ''}</span></td>
                          <td className="px-3 py-2 text-center">{emp.total.toFixed(2)} hrs</td>
                          <td className="px-3 py-2 text-center">{emp.type === 'restaurant' ? '-' : (emp.mult * 100).toFixed(0) + '%'}</td>
                          <td className="px-3 py-2 text-center">{emp.points.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">${weeklyRaw.toFixed(2)}</td>
                          <td className="px-3 py-2 text-center">{frac} ({(prop * 100).toFixed(2)}%)</td>
                          <td className="px-3 py-2 text-center">{(propAfter * 100).toFixed(2)}%</td>
                          <td className="px-3 py-2">
                            <div className="w-full bg-gray-700 rounded h-3">
                              <div className="bg-green-500 h-3 rounded" style={{ width: `${(propAfter * 100) || 0}%` }} />
                            </div>
                          </td>
                          <td className={`px-3 py-2 text-center font-semibold ${weeklyRounded < 0 ? 'text-red-400' : ''}`}>${weeklyRounded.toFixed(2)}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-gray-100 mb-4">Results</h2>
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="grid gap-4">
                  {results.map((result, index) => (
                    <div key={index} className="bg-gray-900 rounded-lg p-4 shadow">
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-100">
                            {result.employee_name}
                          </h3>
                          <p className="text-sm text-gray-300">
                            {result.hours} hours ({result.share_percentage.toFixed(2)}%)
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-400">
                            ${result.tip_amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TipDistribution;
