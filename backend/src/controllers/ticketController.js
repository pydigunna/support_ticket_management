
const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const User = require("../models/User");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


const isTicketOwner = (ticket, user) => {
  if (user.role !== "employee") return false;

  if (ticket.createdByUserId) {
    return ticket.createdByUserId.toString() === user._id.toString();
  }

  // Compatibility for older tickets created before createdByUserId was stored.
  return (
    typeof ticket.createdBy === "string" &&
    ticket.createdBy.trim().toLowerCase() === user.name.trim().toLowerCase()
  );
};

const isAssignedAgent = (ticket, user) => {
  if (user.role !== "agent") return false;

  if (ticket.assigneeUserId) {
    return ticket.assigneeUserId.toString() === user._id.toString();
  }

  return (
    typeof ticket.assignee === "string" &&
    ticket.assignee.trim().toLowerCase() === user.name.trim().toLowerCase()
  );
};

const createTicket = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "A valid ticket object is required" });
    }

    const { title, description, priority, category } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150 ||
      typeof description !== "string" ||
      !description.trim() ||
      description.trim().length > 5000 ||
      typeof category !== "string" ||
      !category.trim() ||
      category.trim().length > 100
    ) {
      return res.status(400).json({
        message: "Title, description, and category are required. Title must be at most 150 characters, description 5000, and category 100.",
      });
    }

    const allowedPriorities = ["Low", "Medium", "High", "Critical"];
    if (priority !== undefined && !allowedPriorities.includes(priority)) {
      return res.status(400).json({ message: "Invalid ticket priority" });
    }

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      priority: priority || "Medium",
      category: category.trim(),
      createdBy: req.user.name,
      createdByUserId: req.user._id,
      assignee: "",
      status: "Open",
      statusHistory: [],
    });

    return res.status(201).json({ message: "Ticket created successfully", ticket });
  } catch (error) {
    next(error);
  }
};

const getTickets = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
      search,
      status,
      priority,
      category,
      assignee,
      createdBy,
    } = req.query;

    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(limitNumber) ||
      limitNumber < 1 ||
      limitNumber > 100
    ) {
      return res.status(400).json({
        message: "Page must be positive and limit must be between 1 and 100",
      });
    }

    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "title",
      "priority",
      "status",
    ];

    if (
      !allowedSortFields.includes(sortBy) ||
      !["asc", "desc"].includes(order)
    ) {
      return res.status(400).json({
        message: "Invalid sorting options",
      });
    }

    const allowedStatuses = ["Open", "In Progress", "Resolved", "Closed"];
    const allowedPriorities = ["Low", "Medium", "High", "Critical"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status filter" });
    }
    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({ message: "Invalid priority filter" });
    }
    if ([category, assignee, createdBy, search].some((value) => typeof value === "string" && value.length > 200)) {
      return res.status(400).json({ message: "Filter values must be 200 characters or fewer" });
    }

    const filter = {};

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignee) filter.assignee = assignee;

    if (createdBy) {
      const escapedName = escapeRegex(createdBy);

      filter.createdBy = {
        $regex: escapedName,
        $options: "i",
      };
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const skip = (pageNumber - 1) * limitNumber;
    const sortDirection = order === "asc" ? 1 : -1;

    const [tickets, totalTickets] = await Promise.all([
      Ticket.find(filter)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limitNumber),
      Ticket.countDocuments(filter),
    ]);

    res.status(200).json({
      page: pageNumber,
      limit: limitNumber,
      totalTickets,
      totalPages: Math.ceil(totalTickets / limitNumber),
      tickets,
    });
  } catch (error) {
    next(error);
  }
};

const getTicketById = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.status(200).json({ ticket });
  } catch (error) {
    next(error);
  }
};

const updateTicket = async (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ message: "A valid ticket object is required" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const isAdmin = req.user.role === "admin";
    const isAssignedAgentForTicket = isAssignedAgent(ticket, req.user);
    const isOwner = isTicketOwner(ticket, req.user);

    if (!isAdmin && !isAssignedAgentForTicket && !isOwner) {
      return res.status(403).json({
        message: "You can edit only tickets assigned to you or tickets you created",
      });
    }

    const editableFields = ["title", "description", "priority", "category"];
    const allowedFields = isAdmin
      ? [...editableFields, "assigneeUserId"]
      : editableFields;
    const providedFields = Object.keys(req.body);

    if (
      providedFields.length === 0 ||
      providedFields.some((field) => !allowedFields.includes(field))
    ) {
      return res.status(400).json({
        message: isAdmin
          ? "Provide valid ticket fields to update"
          : "You may update title, description, priority, and category only",
      });
    }

    const stringLimits = { title: 150, description: 5000, category: 100 };
    for (const [field, maxLength] of Object.entries(stringLimits)) {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] !== "string" || !req.body[field].trim()) {
          return res.status(400).json({ message: `${field} is required` });
        }
        if (req.body[field].trim().length > maxLength) {
          return res.status(400).json({ message: `${field} must be ${maxLength} characters or fewer` });
        }
        req.body[field] = req.body[field].trim();
      }
    }

    if (req.body.priority !== undefined && !["Low", "Medium", "High", "Critical"].includes(req.body.priority)) {
      return res.status(400).json({ message: "Invalid ticket priority" });
    }

    if (req.body.assigneeUserId !== undefined) {
      const requestedAgentId = req.body.assigneeUserId;
      if (requestedAgentId === "" || requestedAgentId === null) {
        ticket.assigneeUserId = null;
        ticket.assignee = "";
      } else {
        if (typeof requestedAgentId !== "string" || !mongoose.isValidObjectId(requestedAgentId)) {
          return res.status(400).json({ message: "A valid agent ID is required" });
        }

        const activeAgent = await User.findOne({
          _id: requestedAgentId,
          role: "agent",
          isActive: true,
        }).select("_id name");

        if (!activeAgent) {
          return res.status(400).json({ message: "Select an active agent as the assignee" });
        }

        ticket.assigneeUserId = activeAgent._id;
        ticket.assignee = activeAgent.name;
      }
    }

    for (const field of editableFields) {
      if (req.body[field] !== undefined) ticket[field] = req.body[field];
    }

    await ticket.save();
    return res.status(200).json({ message: "Ticket updated successfully", ticket });
  } catch (error) {
    next(error);
  }
};

const updateTicketStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["Open", "In Progress", "Resolved", "Closed"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid ticket status" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const isAssignedAgent = ticket.assigneeUserId
      ? ticket.assigneeUserId.toString() === req.user._id.toString()
      : (ticket.assignee || "").trim().toLowerCase() === req.user.name.trim().toLowerCase();

    if (req.user.role === "agent" && !isAssignedAgent) {
      return res.status(403).json({
        message: "Agents can update only tickets assigned to them",
      });
    }

    const allowedTransitions = {
      Open: ["In Progress", "Closed"],
      "In Progress": ["Open", "Resolved", "Closed"],
      Resolved: ["In Progress", "Closed"],
      Closed: [],
    };

    if (!allowedTransitions[ticket.status].includes(status)) {
      return res.status(400).json({
        message: `Cannot change status from ${ticket.status} to ${status}`,
      });
    }

    ticket.statusHistory.push({
      previousStatus: ticket.status,
      newStatus: status,
      changedAt: new Date(),
      changedBy: req.user.name,
    });
    ticket.status = status;

    await ticket.save();
    return res.status(200).json({
      message: "Ticket status updated successfully",
      ticket,
    });
  } catch (error) {
    next(error);
  }
};

const deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = isTicketOwner(ticket, req.user);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        message: "You can delete only tickets you created",
      });
    }

    await ticket.deleteOne();
    return res.status(200).json({ message: "Ticket deleted successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  updateTicket,
  updateTicketStatus,
  deleteTicket,
};
