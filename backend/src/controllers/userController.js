
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const getActiveAgents = async (req, res, next) => {
  try {
    const agents = await User.find({ role: "agent", isActive: true })
      .select("name")
      .sort({ name: 1 });

    res.status(200).json({
      agents: agents.map((agent) => ({ id: agent._id, _id: agent._id, name: agent.name })),
    });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const filter = {};

    if (req.query.role) {
      filter.role = req.query.role;
    }

    if (req.query.role === "agent") {
      filter.isActive = true;
    }

    const users = await User.find(filter)
      .select("name email role isActive")
      .sort({ name: 1 });

    res.status(200).json({
      totalUsers: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

const createAgent = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      name.trim().length > 100 ||
      !email.trim() ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: "Provide a valid name and email. Password must be between 8 and 128 characters.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "A user with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const agent = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "agent",
      isActive: true,
    });

    res.status(201).json({
      message: "Agent created successfully",
      user: {
        id: agent._id,
        name: agent.name,
        email: agent.email,
        role: agent.role,
        isActive: agent.isActive,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A user with this email already exists",
      });
    }

    next(error);
  }
};

const deactivateAgent = async (req, res, next) => {
  try {
    const agent = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        role: "agent",
        isActive: true,
      },
      {
        isActive: false,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("name email role isActive");

    if (!agent) {
      return res.status(404).json({
        message: "Active agent not found",
      });
    }

    res.status(200).json({
      message: "Agent deactivated successfully",
      user: agent,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getActiveAgents,
  createAgent,
  deactivateAgent,
};
