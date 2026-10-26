
const Ticket = require("../models/Ticket");

const getDashboardAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const filter = {};

    if (startDate || endDate) {
      filter.createdAt = {};

      if (startDate) {
        const start = new Date(startDate);

        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({
            message: "Invalid startDate",
          });
        }

        filter.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);

        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({
            message: "Invalid endDate",
          });
        }

        end.setUTCHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }

      if (filter.createdAt.$gte && filter.createdAt.$lte && filter.createdAt.$gte > filter.createdAt.$lte) {
        return res.status(400).json({ message: "startDate must be on or before endDate" });
      }
    }

    const [totalTickets, openTickets, resolvedTickets, criticalTickets,
      statusCounts, priorityCounts] = await Promise.all([
      Ticket.countDocuments(filter),
      Ticket.countDocuments({ ...filter, status: "Open" }),
      Ticket.countDocuments({ ...filter, status: "Resolved" }),
      Ticket.countDocuments({ ...filter, priority: "Critical" }),
      Ticket.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
      ]),
      Ticket.aggregate([
        { $match: filter },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
        { $project: { _id: 0, priority: "$_id", count: 1 } },
      ]),
    ]);

    res.status(200).json({
      summary: {
        totalTickets,
        openTickets,
        resolvedTickets,
        criticalTickets,
      },
      statusCounts,
      priorityCounts,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardAnalytics };
