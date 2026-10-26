import { useCallback, useEffect, useReducer, useState } from "react";
import {
  getAgents,
  createAgent,
  deactivateAgent,
} from "../services/api";

const emptyAgent = { name: "", email: "", password: "" };

const initialState = {
  agents: [],
  loading: true,
  saving: false,
  error: "",
  notice: "",
};

function adminReducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, error: "" };
    case "LOAD_SUCCESS":
      return { ...state, loading: false, agents: action.agents };
    case "LOAD_FAILURE":
      return { ...state, loading: false, error: action.message };
    case "ACTION_START": // add / deactivate begins: clear old messages
      return { ...state, error: "", notice: "" };
    case "SAVE_START":
      return { ...state, saving: true, error: "", notice: "" };
    case "SAVE_END":
      return { ...state, saving: false };
    case "SET_NOTICE":
      return { ...state, notice: action.message };
    case "SET_ERROR":
      return { ...state, error: action.message };
    default:
      return state;
  }
}

function Admin({ token }) {
  const [state, dispatch] = useReducer(adminReducer, initialState);
  const [agentForm, setAgentForm] = useState(emptyAgent);
  const { agents, loading, saving, error, notice } = state;

  const loadAgents = useCallback(async () => {
    dispatch({ type: "LOAD_START" });

    try {
      const data = await getAgents(token);
      dispatch({ type: "LOAD_SUCCESS", agents: data });
    } catch (err) {
      dispatch({ type: "LOAD_FAILURE", message: err.message || "Unable to load agents" });
    }
  }, [token]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setAgentForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    dispatch({ type: "SAVE_START" });

    try {
      await createAgent(token, agentForm);

      setAgentForm(emptyAgent);
      dispatch({ type: "SET_NOTICE", message: "Agent added successfully." });

      await loadAgents();
    } catch (err) {
      dispatch({ type: "SET_ERROR", message: err.message || "Unable to add agent" });
    } finally {
      dispatch({ type: "SAVE_END" });
    }
  };

  const handleDeactivate = async (agent) => {
    const confirmed = window.confirm(
      `Deactivate ${agent.name}? They will no longer be able to log in.`
    );

    if (!confirmed) return;

    dispatch({ type: "ACTION_START" });

    try {
      await deactivateAgent(token, agent._id || agent.id);
      dispatch({ type: "SET_NOTICE", message: `${agent.name} was deactivated.` });
      await loadAgents();
    } catch (err) {
      dispatch({ type: "SET_ERROR", message: err.message || "Unable to deactivate agent" });
    }
  };

  return (
    <section className="admin-page">
      <div className="page-heading">
        <div>
          <h1>Admin Panel</h1>
          <p>Add support agents and manage existing agents.</p>
        </div>
      </div>

      {notice && (
        <p className="success-message" role="status">
          {notice}
        </p>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <div className="admin-grid">
        <form className="admin-card" onSubmit={handleSubmit}>
          <h2>Add Agent</h2>

          <label htmlFor="agent-name">Full name</label>
          <input
            id="agent-name"
            name="name"
            value={agentForm.name}
            onChange={handleChange}
            required
          />

          <label htmlFor="agent-email">Email</label>
          <input
            id="agent-email"
            name="email"
            type="email"
            value={agentForm.email}
            onChange={handleChange}
            required
          />

          <label htmlFor="agent-password">Temporary password</label>
          <input
            id="agent-password"
            name="password"
            type="password"
            value={agentForm.password}
            onChange={handleChange}
            minLength={8}
            autoComplete="new-password"
            required
          />

          <p className="admin-help">
            The password must contain at least 8 characters.
          </p>

          <button type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add Agent"}
          </button>
        </form>

        <div className="admin-card">
          <h2>Support Agents</h2>

          {loading ? (
            <p>Loading agents...</p>
          ) : agents.length === 0 ? (
            <p>No active agents found. Add your first agent.</p>
          ) : (
            <div className="agent-list">
              {agents.map((agent) => (
                <div className="agent-item" key={agent._id || agent.id}>
                  <div className="agent-details">
                    <strong>{agent.name}</strong>
                    <span>{agent.email}</span>
                  </div>

                  <button
                    type="button"
                    className="deactivate-button"
                    onClick={() => handleDeactivate(agent)}
                  >
                    Deactivate
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && (
            <button
              type="button"
              className="secondary-button"
              onClick={loadAgents}
            >
              Refresh Agents
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default Admin;
