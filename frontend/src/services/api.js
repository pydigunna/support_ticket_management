const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(endpoint, options = {}, token) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

export const getTickets = (params = {}) => {
  const query = new URLSearchParams(params);
  return request(`/tickets?${query.toString()}`);
};

export const getAnalytics = (params = {}) => {
  const query = new URLSearchParams(params);
  return request(`/analytics?${query.toString()}`);
};

export const createTicket = (ticket, token) =>
  request("/tickets", { method: "POST", body: JSON.stringify(ticket) }, token);

export const updateTicket = (id, changes, token) =>
  request(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(changes) }, token);

export const updateTicketStatus = (id, status, token) =>
  request(`/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token);

export const deleteTicket = (id, token) =>
  request(`/tickets/${id}`, { method: "DELETE" }, token);

export const getAgents = async (token) => {
  const data = await request("/users?role=agent", {}, token);
  return data.users;
};

export const getAssigneeAgents = async () => {
  const data = await request("/users/agents/list");
  return data.agents;
};

export const createAgent = async (token, agent) =>
  request("/users/agents", { method: "POST", body: JSON.stringify(agent) }, token);

export const deactivateAgent = async (token, agentId) =>
  request(`/users/agents/${agentId}/deactivate`, { method: "PATCH" }, token);
