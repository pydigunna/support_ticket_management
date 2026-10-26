import { useState } from "react";
import { Routes, Route, Link, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Tickets from "./pages/Tickets";
import Login from "./pages/Login";
import Admin from "./pages/Admin";

function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found-card">
        <span className="not-found-code">404</span>
        <h1>Page Not Found</h1>
        <p>Sorry, we couldn't find the page you're looking for.</p>
        <Link to="/" className="not-found-button">Go to Dashboard</Link>
      </div>
    </div>
  );
}

function roleLabel(role) {
  if (role === "employee") return "User";
  if (role === "agent") return "Agent";
  if (role === "admin") return "Admin";
  return "";
}

function App() {
  const [auth, setAuth] = useState(() => {
    try {
      const savedAuth = sessionStorage.getItem("ticketAuth");
      return savedAuth ? JSON.parse(savedAuth) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (data) => {
    sessionStorage.setItem("ticketAuth", JSON.stringify(data));
    setAuth(data);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("ticketAuth");
    setAuth(null);
  };

  return (
    <>
      <Navbar />
      <div className="session-bar">
        {auth?.user ? (
          <>
            <span>{roleLabel(auth.user.role)}: {auth.user.name}</span>
            {auth.user.role === "admin" && <Link to="/admin">Admin Panel</Link>}
            <button type="button" onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <Link to="/login">User / Agent / Admin Login</Link>
        )}
      </div>

      <main className="container">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets auth={auth} />} />
          <Route
            path="/login"
            element={auth?.user ? <Navigate to={auth.user.role === "admin" ? "/admin" : "/tickets"} replace /> : <Login onLogin={handleLogin} />}
          />
          <Route
            path="/admin"
            element={auth?.user?.role === "admin" && auth?.token ? <Admin token={auth.token} /> : <Navigate to="/login" replace />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
