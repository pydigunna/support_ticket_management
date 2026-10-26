import { useCallback, useEffect, useReducer } from "react";
import { Link } from "react-router-dom";
import TicketTable from "../components/TicketTable";
import TicketForm from "../components/TicketForm";
import {
  getTickets,
  createTicket,
  updateTicket,
  updateTicketStatus,
  deleteTicket,
  getAssigneeAgents,
} from "../services/api";

const PAGE_SIZE = 5;

const STATUS_OPTIONS = ["Open", "In Progress", "Resolved", "Closed"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];
const CATEGORY_OPTIONS = [
  "Technical",
  "Account",
  "Billing",
  "Payment",
  "Profile",
  "Hardware",
  "Software",
  "Network",
  "Other",
];
const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "title:asc", label: "Title A–Z" },
  { value: "priority:desc", label: "Priority Z–A" },
  { value: "status:asc", label: "Status A–Z" },
];

/* ---------- Filters: search, filters, sorting and page live together ---------- */

const initialFilters = {
  searchInput: "", // what the user is typing
  search: "", // debounced value sent to the API
  status: "",
  priority: "",
  category: "",
  assignee: "",
  createdBy: "",
  sortOption: "createdAt:desc",
  page: 1,
};

function filtersReducer(state, action) {
  switch (action.type) {
    case "SET_SEARCH_INPUT":
      return { ...state, searchInput: action.value };
    case "COMMIT_SEARCH":
      if (state.search === state.searchInput) return state;
      return { ...state, search: state.searchInput, page: 1 };
    case "SET_FILTER":
      // any filter / sort change goes back to the first page
      return { ...state, [action.field]: action.value, page: 1 };
    case "SET_PAGE":
      return { ...state, page: action.page };
    default:
      return state;
  }
}

/* ---------- Ticket list: data + loading + load error ---------- */

const initialList = {
  tickets: [],
  totalPages: 1,
  loading: true,
  loadError: "",
};

function listReducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true, loadError: "" };
    case "LOAD_SUCCESS":
      return {
        ...state,
        loading: false,
        tickets: action.tickets,
        totalPages: Math.max(1, action.totalPages || 1),
      };
    case "LOAD_FAILURE":
      return { ...state, loading: false, loadError: action.message };
    default:
      return state;
  }
}

/* ---------- UI: create form, edit modal, messages ---------- */

const initialUi = {
  showForm: false,
  editingTicket: null,
  error: "",
  notice: "",
};

function uiReducer(state, action) {
  switch (action.type) {
    case "TOGGLE_FORM":
      return { ...state, showForm: !state.showForm };
    case "CLOSE_FORM":
      return { ...state, showForm: false };
    case "START_EDIT":
      return { ...state, editingTicket: action.ticket };
    case "STOP_EDIT":
      return { ...state, editingTicket: null };
    case "CLEAR_MESSAGES":
      return { ...state, error: "", notice: "" };
    case "SET_ERROR":
      return { ...state, error: action.message };
    case "SET_NOTICE":
      return { ...state, notice: action.message };
    default:
      return state;
  }
}

/* ---------- Agents (for assignee filter / assignment) ---------- */

const initialAgents = { list: [], loading: false };

function agentsReducer(state, action) {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, loading: true };
    case "LOAD_SUCCESS":
      return { list: action.agents, loading: false };
    case "LOAD_FAILURE":
      return { list: [], loading: false };
    default:
      return state;
  }
}

function Tickets({ auth }) {
  const [filters, dispatchFilters] = useReducer(filtersReducer, initialFilters);
  const [list, dispatchList] = useReducer(listReducer, initialList);
  const [ui, dispatchUi] = useReducer(uiReducer, initialUi);
  const [agentState, dispatchAgents] = useReducer(agentsReducer, initialAgents);

  const { tickets, totalPages, loading, loadError } = list;
  const { showForm, editingTicket, error, notice } = ui;
  const { list: agents, loading: loadingAgents } = agentState;
  const { searchInput, search, status, priority, category, assignee, createdBy, sortOption, page } = filters;

  const role = auth?.user?.role?.toLowerCase() || "public";
  const isAdmin = role === "admin" && Boolean(auth?.token);
  const canCreate = Boolean(auth?.token && auth?.user);

  const canEditTicket = (ticket) => {
    if (!auth?.token || !auth?.user || !ticket) return false;
    if (role === "admin") return true;
    if (role === "agent") {
      return ticket.assigneeUserId
        ? String(ticket.assigneeUserId) === String(auth.user.id || auth.user._id)
        : ticket.assignee?.trim().toLowerCase() === (auth.user.name || "").trim().toLowerCase();
    }
    if (role === "employee") {
      return Boolean(ticket.createdByUserId) &&
        String(ticket.createdByUserId) === String(auth.user.id || auth.user._id);
    }
    return false;
  };

  const loadTickets = useCallback(async () => {
    dispatchList({ type: "LOAD_START" });

    try {
      const [sortBy, order] = sortOption.split(":");
      const params = { page, limit: PAGE_SIZE, sortBy, order };

      if (search.trim()) params.search = search.trim();
      if (status) params.status = status;
      if (priority) params.priority = priority;
      if (category) params.category = category;
      if (assignee) params.assignee = assignee;
      if (createdBy.trim()) params.createdBy = createdBy.trim();

      const data = await getTickets(params);

      dispatchList({
        type: "LOAD_SUCCESS",
        tickets: data.tickets || [],
        totalPages: data.totalPages,
      });
    } catch (err) {
      dispatchList({
        type: "LOAD_FAILURE",
        message:
          err.message ||
          "Unable to load tickets. Check whether the server is running.",
      });
    }
  }, [page, search, status, priority, category, assignee, createdBy, sortOption]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Debounce the search box: commit the typed value 300ms after typing stops.
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatchFilters({ type: "COMMIT_SEARCH" });
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Load active agents for the assignee filter for every role.
  useEffect(() => {
    let cancelled = false;

    async function loadAgents() {
      dispatchAgents({ type: "LOAD_START" });

      try {
        const data = await getAssigneeAgents();
        if (!cancelled) {
          dispatchAgents({
            type: "LOAD_SUCCESS",
            agents: Array.isArray(data) ? data : [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          dispatchAgents({ type: "LOAD_FAILURE" });
          dispatchUi({
            type: "SET_ERROR",
            message: "Unable to load agents: " + err.message,
          });
        }
      }
    }

    loadAgents();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (form) => {
    dispatchUi({ type: "CLEAR_MESSAGES" });

    try {
      if (!auth?.token) {
        throw new Error("Please log in before creating a ticket.");
      }

      await createTicket(form, auth.token);
      dispatchUi({ type: "CLOSE_FORM" });
      dispatchUi({ type: "SET_NOTICE", message: "Ticket created successfully." });
      dispatchFilters({ type: "SET_PAGE", page: 1 });

      if (page === 1) {
        await loadTickets();
      }
    } catch (err) {
      dispatchUi({ type: "SET_ERROR", message: err.message });
      throw err;
    }
  };

  const handleUpdate = async (form) => {
    if (!editingTicket || !canEditTicket(editingTicket)) {
      throw new Error("You do not have permission to edit this ticket.");
    }

    dispatchUi({ type: "CLEAR_MESSAGES" });

    try {
      await updateTicket(editingTicket._id, form, auth.token);
      dispatchUi({ type: "STOP_EDIT" });
      dispatchUi({ type: "SET_NOTICE", message: "Ticket details updated successfully." });
      await loadTickets();
    } catch (err) {
      dispatchUi({ type: "SET_ERROR", message: err.message });
      throw err;
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    dispatchUi({ type: "CLEAR_MESSAGES" });

    try {
      await updateTicketStatus(id, newStatus, auth?.token);
      dispatchUi({ type: "SET_NOTICE", message: "Ticket status updated successfully." });
      await loadTickets();
    } catch (err) {
      dispatchUi({ type: "SET_ERROR", message: err.message });
      await loadTickets();
    }
  };

  const handleAssign = async (ticketId, newAssignee) => {
    if (!isAdmin) {
      dispatchUi({ type: "SET_ERROR", message: "Only an admin can assign tickets." });
      return;
    }

    dispatchUi({ type: "CLEAR_MESSAGES" });

    try {
      await updateTicket(ticketId, { assigneeUserId: newAssignee }, auth.token);

      dispatchUi({
        type: "SET_NOTICE",
        message: newAssignee
          ? "Ticket assignment updated successfully."
          : "Ticket is now unassigned.",
      });

      await loadTickets();
    } catch (err) {
      dispatchUi({ type: "SET_ERROR", message: err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!auth?.token) {
      dispatchUi({ type: "SET_ERROR", message: "Please log in to delete your ticket." });
      return;
    }

    if (!window.confirm("Are you sure you want to delete this ticket?")) return;

    dispatchUi({ type: "CLEAR_MESSAGES" });

    try {
      await deleteTicket(id, auth.token);
      dispatchUi({ type: "SET_NOTICE", message: "Ticket deleted successfully." });
      await loadTickets();
    } catch (err) {
      dispatchUi({ type: "SET_ERROR", message: err.message });
    }
  };

  // One handler for every filter/sort control — each control has a `name`
  // that matches a key in the filters object.
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    dispatchFilters({ type: "SET_FILTER", field: name, value });
  };

  return (
    <section>
      <div className="page-heading">
        <div>
          <h1>Support Tickets</h1>
          <p>Create, search, and manage support requests.</p>
        </div>

        {canCreate ? (
          <button type="button" onClick={() => dispatchUi({ type: "TOGGLE_FORM" })}>
            {showForm ? "Close Form" : "+ New Ticket"}
          </button>
        ) : (
          <Link className="not-found-button" to="/login">
            Log in to create a ticket
          </Link>
        )}
      </div>

      {showForm && (
        <TicketForm
          onSubmit={handleCreate}
          onCancel={() => dispatchUi({ type: "CLOSE_FORM" })}
          userName={auth?.user?.name || ""}
        />
      )}

      {editingTicket && canEditTicket(editingTicket) && (
        <div
          className="edit-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dispatchUi({ type: "STOP_EDIT" });
          }}
        >
          <div className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-ticket-title">
            <TicketForm
              key={editingTicket._id}
              mode="edit"
              initialValues={editingTicket}
              onSubmit={handleUpdate}
              onCancel={() => dispatchUi({ type: "STOP_EDIT" })}
              userName={auth?.user?.name || ""}
            />
          </div>
        </div>
      )}

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

      {isAdmin && (
        <p>
          {loadingAgents
            ? "Loading agents..."
            : "Active agents available for assignment: " + agents.length}
        </p>
      )}

      <div className="filters">
        <input
          placeholder="Search tickets..."
          value={searchInput}
          onChange={(event) =>
            dispatchFilters({ type: "SET_SEARCH_INPUT", value: event.target.value })
          }
        />

        <input
          name="createdBy"
          placeholder="Filter by creator..."
          value={createdBy}
          onChange={handleFilterChange}
        />

        <select name="status" value={status} onChange={handleFilterChange}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>

        <select name="priority" value={priority} onChange={handleFilterChange}>
          <option value="">All priorities</option>
          {PRIORITY_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>

        <select
          name="sortOption"
          aria-label="Sort tickets"
          value={sortOption}
          onChange={handleFilterChange}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select name="category" value={category} onChange={handleFilterChange}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>

        <select
          name="assignee"
          value={assignee}
          onChange={handleFilterChange}
          disabled={loadingAgents}
        >
          <option value="">
            {loadingAgents ? "Loading assignees..." : "All assignees"}
          </option>

          {agents.map((agent) => (
            <option key={agent._id || agent.id} value={agent.name}>
              {agent.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Loading tickets...</p>
      ) : loadError ? (
        <div className="error-message" role="alert">
          <p>
            <strong>Unable to load tickets</strong>
          </p>
          <p>{loadError}</p>
          <button type="button" onClick={loadTickets}>
            Retry
          </button>
        </div>
      ) : (
        <TicketTable
          tickets={tickets}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onEdit={(ticket) => dispatchUi({ type: "START_EDIT", ticket })}
          agents={agents}
          isAdmin={isAdmin}
          onAssign={handleAssign}
          authRole={role}
          authUserId={auth?.user?.id || auth?.user?._id || ""}
          authUserName={auth?.user?.name || ""}
        />
      )}

      {!loading && !loadError && (
        <div className="pagination">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => dispatchFilters({ type: "SET_PAGE", page: page - 1 })}
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => dispatchFilters({ type: "SET_PAGE", page: page + 1 })}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

export default Tickets;
