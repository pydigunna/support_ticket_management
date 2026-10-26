const express = require("express");
const {
  getUsers,
  getActiveAgents,
  createAgent,
  deactivateAgent,
} = require("../controllers/userController");
const { protect, authorize } = require("../middleware/authMiddleware");

const router = express.Router();

// Safe, read-only list used by the assignee filter for every role.
router.get("/agents/list", getActiveAgents);

// Agent account management remains admin-only.
router.use(protect, authorize("admin"));
router.get("/", getUsers);
router.post("/agents", createAgent);
router.patch("/agents/:id/deactivate", deactivateAgent);

module.exports = router;
