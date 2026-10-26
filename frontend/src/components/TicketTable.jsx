
import { Fragment, useState } from "react";

function TicketTable({
  tickets,
  onStatusChange,
  onDelete,
  onEdit,
  agents = [],
  isAdmin = false,
  onAssign,
  authRole = "public",
  authUserId = "",
  authUserName = "",
}) {
  const [expandedTicket, setExpandedTicket] = useState(null);

  if (tickets.length === 0) {
    return <p className="empty-message">No tickets found.</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="ticket-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Created By</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Category</th>
            <th>Assignee</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {tickets.map((ticket) => (
            <Fragment key={ticket._id}>
              <tr>
                <td>
                  <strong>{ticket.title}</strong>
                  <p className="ticket-description">
                    {ticket.description}
                  </p>
                </td>

                <td>{ticket.createdBy || "Unknown"}</td>

                <td>
                  <span
                    className={`priority priority-${ticket.priority.toLowerCase()}`}
                  >
                    {ticket.priority}
                  </span>
                </td>

                <td>
                  <span className={`status-label status-${ticket.status.toLowerCase().replace(" ", "-")}`}>
                    {ticket.status}
                  </span>
                </td>

                <td>{ticket.category}</td>

                <td>
                  {isAdmin ? (
                    <select
                      value={ticket.assigneeUserId || ""}
                      onChange={(event) =>
                        onAssign(ticket._id, event.target.value)
                      }
                      aria-label={`Assign ${ticket.title}`}
                    >
                      <option value="">Unassigned</option>
                      {agents.map((agent) => (
                        <option
                          key={agent._id || agent.id}
                          value={agent._id || agent.id}
                        >
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ticket.assignee || "Unassigned"
                  )}
                </td>

                <td>
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </td>

                <td>
                  <div className="table-actions">
                    {(isAdmin ||
                      (authRole === "agent" && (ticket.assigneeUserId
                        ? String(ticket.assigneeUserId) === String(authUserId)
                        : ticket.assignee?.trim().toLowerCase() === authUserName.trim().toLowerCase())) ||
                      (authRole === "employee" && ticket.createdByUserId &&
                        String(ticket.createdByUserId) === String(authUserId))) && (
                      <button type="button" onClick={() => onEdit?.(ticket)}>
                        Edit
                      </button>
                    )}
                    {(isAdmin || (authRole === "agent" && (ticket.assigneeUserId
                      ? String(ticket.assigneeUserId) === String(authUserId)
                      : ticket.assignee?.trim().toLowerCase() === authUserName.trim().toLowerCase()))) && ticket.status !== "Closed" && (
                      <select
                        value={ticket.status}
                        onChange={(event) =>
                          onStatusChange(
                            ticket._id,
                            event.target.value
                          )
                        }
                        aria-label={`Change status for ${ticket.title}`}
                      >
                        <option value={ticket.status} disabled>{ticket.status}</option>
                        {(ticket.status === "Open"
                          ? ["In Progress", "Closed"]
                          : ticket.status === "In Progress"
                            ? ["Open", "Resolved", "Closed"]
                            : ticket.status === "Resolved"
                              ? ["In Progress", "Closed"]
                              : []).map((nextStatus) => (
                          <option key={nextStatus} value={nextStatus}>
                            {nextStatus}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTicket(
                          expandedTicket === ticket._id
                            ? null
                            : ticket._id
                        )
                      }
                    >
                      {expandedTicket === ticket._id
                        ? "Hide History"
                        : "View History"}
                    </button>

                    {(isAdmin || (authRole === "employee" && ticket.createdByUserId && String(ticket.createdByUserId) === String(authUserId))) && (
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => onDelete(ticket._id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {expandedTicket === ticket._id && (
                <tr>
                  <td colSpan={8}>
                    <div className="ticket-timeline">
                      <h3>Activity Timeline</h3>

                      {ticket.statusHistory?.length > 0 ? (
                        <ol className="timeline-list">
                          {[...ticket.statusHistory]
                            .reverse()
                            .map((history, index) => (
                              <li
                                key={`${history.changedAt}-${index}`}
                                className="timeline-item"
                              >
                                <strong>
                                  {history.previousStatus} →{" "}
                                  {history.newStatus}
                                </strong>

                                <p>
                                  <strong>Changed at:</strong>{" "}
                                  {new Date(history.changedAt).toLocaleString()}
                                </p>
                                {history.changedBy && (
                                  <p><strong>Changed by:</strong> {history.changedBy}</p>
                                )}
                              </li>
                            ))}
                        </ol>
                      ) : (
                        <p>No status changes recorded yet.</p>
                      )}

                      <p>
                        <strong>Current status:</strong>{" "}
                        {ticket.status}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TicketTable;
