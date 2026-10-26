import { useReducer } from "react";
import { useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const initialState = {
  mode: "login", // "login" | "register"
  values: { name: "", email: "", password: "" },
  error: "",
  loading: false,
};

function loginReducer(state, action) {
  switch (action.type) {
    case "FIELD_CHANGE":
      return { ...state, values: { ...state.values, [action.field]: action.value } };
    case "TOGGLE_MODE":
      return { ...state, mode: state.mode === "login" ? "register" : "login", error: "" };
    case "SUBMIT_START":
      return { ...state, error: "", loading: true };
    case "SUBMIT_FAILURE":
      return { ...state, error: action.message };
    case "SUBMIT_END":
      return { ...state, loading: false };
    default:
      return state;
  }
}

function Login({ onLogin }) {
  const [state, dispatch] = useReducer(loginReducer, initialState);
  const navigate = useNavigate();
  const { mode, values, error, loading } = state;
  const isRegister = mode === "register";

  const handleChange = (event) => {
    const { name, value } = event.target;
    dispatch({ type: "FIELD_CHANGE", field: name, value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    dispatch({ type: "SUBMIT_START" });

    try {
      const endpoint = isRegister ? "register" : "login";
      const body = isRegister
        ? { name: values.name, email: values.email, password: values.password }
        : { email: values.email, password: values.password };
      const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || (isRegister ? "Registration failed" : "Login failed"));
      }

      onLogin(data);
      navigate(data.user.role === "admin" ? "/admin" : "/tickets");
    } catch (err) {
      dispatch({
        type: "SUBMIT_FAILURE",
        message: err.message || "Unable to connect to the server",
      });
    } finally {
      dispatch({ type: "SUBMIT_END" });
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p>{isRegister ? "Register as a ticket requester." : "Sign in as a user, agent, or admin."}</p>

        {error && <p className="error-message" role="alert">{error}</p>}

        {isRegister && (
          <>
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              name="name"
              value={values.name}
              onChange={handleChange}
              autoComplete="name"
              maxLength={100}
              required
            />
          </>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={handleChange}
          autoComplete="username"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          value={values.password}
          onChange={handleChange}
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={isRegister ? 8 : undefined}
          required
        />

        {isRegister && <p className="admin-help">Use at least 8 characters. Public registration creates a standard user account only.</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : isRegister ? "Create account" : "Sign in"}
        </button>

        <p className="login-switch">
          {isRegister ? "Already have an account?" : "Need a user account?"}{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => dispatch({ type: "TOGGLE_MODE" })}
          >
            {isRegister ? "Sign in" : "Register"}
          </button>
        </p>
        <p className="admin-help">Agents sign in using credentials provided by an admin. Admins use their existing admin account.</p>
      </form>
    </div>
  );
}

export default Login;
