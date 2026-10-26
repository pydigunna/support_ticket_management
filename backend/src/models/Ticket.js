const mongoose = require("mongoose");

const statusHistorySchema = new mongoose.Schema(
  {
    previousStatus: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      required: true,
    },
    newStatus: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      required: true,
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    changedBy: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Ticket title is required"],
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      required: [true, "Ticket description is required"],
      trim: true,
      maxlength: 5000,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      required: true,
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      default: "Open",
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      maxlength: 100,
    },
    createdBy: {
      type: String,
      required: [true, "Creator is required"],
      trim: true,
      maxlength: 100,
    },
    createdByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    assignee: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    assigneeUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
