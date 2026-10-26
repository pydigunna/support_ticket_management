import { useCallback, useEffect, useReducer, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { getAnalytics } from "../services/api";

const chartColors = ["#4f46e5", "#0d9488", "#f59e0b", "#dc2626"];

const initialState = { analytics: null, loading: true, error: "" };

function dashboardReducer(state, action) {
  switch (action.type) {
    case "FETCH_START":
      return { ...state, loading: true, error: "" };
    case "FETCH_SUCCESS":
      return { ...state, loading: false, analytics: action.analytics };
    case "FETCH_FAILURE":
      return { ...state, loading: false, error: action.message };
    case "SET_ERROR":
      return { ...state, error: action.message };
    default:
      return state;
  }
}

const emptyDates = { startDate: "", endDate: "" };

function Dashboard() {
  const [{ analytics, loading, error }, dispatch] = useReducer(dashboardReducer, initialState);
  const [dates, setDates] = useState(emptyDates);
  const { startDate, endDate } = dates;

  const loadAnalytics = useCallback(async (range = emptyDates) => {
    dispatch({ type: "FETCH_START" });

    try {
      const params = {};
      if (range.startDate) params.startDate = range.startDate;
      if (range.endDate) params.endDate = range.endDate;
      const data = await getAnalytics(params);
      dispatch({ type: "FETCH_SUCCESS", analytics: data });
    } catch (err) {
      dispatch({
        type: "FETCH_FAILURE",
        message: err.message || "Unable to load dashboard analytics",
      });
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleDateChange = (event) => {
    const { name, value } = event.target;
    setDates((current) => ({ ...current, [name]: value }));
  };

  const handleApplyDates = (event) => {
    event.preventDefault();
    if (startDate && endDate && startDate > endDate) {
      dispatch({ type: "SET_ERROR", message: "Start date must be on or before end date." });
      return;
    }
    loadAnalytics(dates);
  };

  const handleResetDates = () => {
    setDates(emptyDates);
    loadAnalytics();
  };

  const summary = analytics?.summary;
  const statusCounts = analytics?.statusCounts || [];
  const priorityCounts = analytics?.priorityCounts || [];
  const metrics = summary ? [
    { label: "Total Tickets", value: summary.totalTickets },
    { label: "Open Tickets", value: summary.openTickets },
    { label: "Resolved Tickets", value: summary.resolvedTickets },
    { label: "Critical Tickets", value: summary.criticalTickets },
  ] : [];

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Monitor your support team's performance.</p>
        </div>
      </div>

      <form className="filters analytics-filters" onSubmit={handleApplyDates}>
        <label>
          From
          <input type="date" name="startDate" value={startDate} max={endDate || undefined} onChange={handleDateChange} />
        </label>
        <label>
          To
          <input type="date" name="endDate" value={endDate} min={startDate || undefined} onChange={handleDateChange} />
        </label>
        <button type="submit" disabled={loading}>Apply date range</button>
        <button type="button" className="secondary-button" onClick={handleResetDates} disabled={loading}>Clear dates</button>
      </form>

      {error && <p className="error-message" role="alert">{error}</p>}
      {loading && <p>Loading dashboard...</p>}

      {!loading && analytics && (
        <>
          <div className="metrics-grid">
            {metrics.map((metric) => (
              <article className="metric-card" key={metric.label}>
                <p>{metric.label}</p>
                <h2>{metric.value}</h2>
              </article>
            ))}
          </div>

          <div className="charts-grid">
            <article className="chart-card">
              <h3>Tickets by Status</h3>
              {statusCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={statusCounts}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p>No status data available for this date range.</p>}
            </article>

            <article className="chart-card">
              <h3>Tickets by Priority</h3>
              {priorityCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={priorityCounts} dataKey="count" nameKey="priority" cx="50%" cy="50%" outerRadius={90} label>
                      {priorityCounts.map((entry, index) => (
                        <Cell key={entry.priority} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p>No priority data available for this date range.</p>}
            </article>
          </div>
        </>
      )}
    </section>
  );
}

export default Dashboard;
