const express = require("express");
const {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  updateTicketStatus,
  deleteTicket,
} = require("../controllers/ticketController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Tickets and status history are viewable without logging in.
// Creating a ticket requires an account so ownership can be verified.
router.post("/", protect, authorize("employee", "agent", "admin"), createTicket);
router.get("/", getTickets);
router.get("/:id", getTicketById);

// Admins can edit any ticket; agents can edit assigned tickets; employees can edit tickets they created.
// The controller enforces ticket ownership/assignment and prevents non-admin assignment changes.
router.patch("/:id", protect, authorize("employee", "agent", "admin"), updateTicket);

// Agents can update tickets assigned to them; admins can update any ticket.
router.patch("/:id/status", protect, authorize("agent", "admin"), updateTicketStatus);

// A user can delete their own ticket; admins can delete any ticket.
router.delete("/:id", protect, authorize("employee", "admin"), deleteTicket);

module.exports = router;
