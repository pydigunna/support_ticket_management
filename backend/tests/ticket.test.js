
const {
  describe,
  it,
  before,
  beforeEach,
  after,
} = require("node:test");

const assert = require("node:assert/strict");
const request = require("supertest");
const mongoose = require("mongoose");
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-ticket-tests";
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const Ticket = require("../src/models/Ticket");
const User = require("../src/models/User");

async function createAuth(role = "employee", name = "Test User") {
  const email = `${role}-${name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now()}@example.com`;
  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash("Password123", 4),
    role,
    isActive: true,
  });
  const token = jwt.sign({ role }, process.env.JWT_SECRET, {
    subject: user._id.toString(),
    expiresIn: "1h",
  });
  return { user, token, authorization: `Bearer ${token}` };
}

const TEST_DB_URI =
  "mongodb://127.0.0.1:27017/support_ticket_test_db";

describe("Ticket API", () => {
  before(async () => {
    await mongoose.connect(TEST_DB_URI, {
      serverSelectionTimeoutMS: 5000,
      family: 4,
    });
  });

  beforeEach(async () => {
    await Ticket.deleteMany({});
    await User.deleteMany({});
  });

  after(async () => {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  it("should reject a ticket with missing required fields", async () => {
    const auth = await createAuth("employee");
    const response = await request(app)
      .post("/api/tickets")
      .set("Authorization", auth.authorization)
      .send({ title: "" });

    assert.equal(response.status, 400);
  });

  it("should return an empty ticket list", async () => {
    const response = await request(app).get("/api/tickets");

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.tickets, []);
    assert.equal(response.body.totalTickets, 0);
  });

  it("should reject an invalid ticket ID", async () => {
    const response = await request(app).get(
      "/api/tickets/invalid-id"
    );

    assert.equal(response.status, 400);
    assert.equal(response.body.message, "Invalid ID format");
  });

  it("should reject an invalid status transition", async () => {
    const ticket = await Ticket.create({
      title: "Test ticket",
      description: "Testing status transitions",
      priority: "Medium",
      status: "Closed",
      category: "Testing",
      createdBy: "Admin",
      assignee: "Support Team",
    });

    const auth = await createAuth("admin", "System Admin");
    const response = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set("Authorization", auth.authorization)
      .send({ status: "Open" });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.message,
      "Cannot change status from Closed to Open"
    );
  });

  it("should support pagination", async () => {
    await Ticket.create([
      {
        title: "Ticket One",
        description: "First test ticket",
        priority: "High",
        category: "Testing",
        createdBy: "Admin",
      },
      {
        title: "Ticket Two",
        description: "Second test ticket",
        priority: "Low",
        category: "Testing",
        createdBy: "Admin",
      },
      {
        title: "Ticket Three",
        description: "Third test ticket",
        priority: "Medium",
        category: "Testing",
        createdBy: "Admin",
      },
    ]);

    const response = await request(app).get(
      "/api/tickets?page=1&limit=2"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.totalTickets, 3);
    assert.equal(response.body.totalPages, 2);
    assert.equal(response.body.tickets.length, 2);
  });

  it("should filter tickets by priority", async () => {
    await Ticket.create([
      {
        title: "Critical issue",
        description: "Critical test ticket",
        priority: "Critical",
        category: "Testing",
        createdBy: "Admin",
      },
      {
        title: "Low priority issue",
        description: "Low priority test ticket",
        priority: "Low",
        category: "Testing",
        createdBy: "Admin",
      },
      {
        title: "Another critical issue",
        description: "Another critical test ticket",
        priority: "Critical",
        category: "Testing",
        createdBy: "Admin",
      },
    ]);

    const response = await request(app).get(
      "/api/tickets?priority=Critical"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.totalTickets, 2);
    assert.equal(response.body.tickets.length, 2);

    for (const ticket of response.body.tickets) {
      assert.equal(ticket.priority, "Critical");
    }
  });

  it("should combine priority and category filters", async () => {
    await Ticket.create([
      {
        title: "High testing issue",
        description: "Matches both filters",
        priority: "High",
        category: "Testing",
        createdBy: "Admin",
      },
      {
        title: "Low testing issue",
        description: "Wrong priority",
        priority: "Low",
        category: "Testing",
        createdBy: "Admin",
      },
      {
        title: "High payment issue",
        description: "Wrong category",
        priority: "High",
        category: "Payment",
        createdBy: "Admin",
      },
    ]);

    const response = await request(app).get(
      "/api/tickets?priority=High&category=Testing"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.totalTickets, 1);
    assert.equal(response.body.tickets.length, 1);
    assert.equal(
      response.body.tickets[0].title,
      "High testing issue"
    );
  });

  it("should search tickets by title", async () => {
    await Ticket.create([
      {
        title: "Login issue",
        description: "Cannot access the account",
        priority: "High",
        category: "Authentication",
        createdBy: "Admin",
      },
      {
        title: "Payment issue",
        description: "Checkout is failing",
        priority: "Medium",
        category: "Payment",
        createdBy: "Admin",
      },
    ]);

    const response = await request(app).get(
      "/api/tickets?search=Login"
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.totalTickets, 1);
    assert.equal(
      response.body.tickets[0].title,
      "Login issue"
    );
  });

  it("should record status changes in history", async () => {
    const ticket = await Ticket.create({
      title: "Login issue",
      description: "Cannot access the account",
      priority: "High",
      status: "Open",
      category: "Authentication",
      createdBy: "Admin",
    });

    const auth = await createAuth("admin", "System Admin");
    const response = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set("Authorization", auth.authorization)
      .send({ status: "In Progress" });

    assert.equal(response.status, 200);
    assert.equal(response.body.ticket.status, "In Progress");
    assert.equal(
      response.body.ticket.statusHistory.length,
      1
    );

    assert.equal(
      response.body.ticket.statusHistory[0].previousStatus,
      "Open"
    );

    assert.equal(
      response.body.ticket.statusHistory[0].newStatus,
      "In Progress"
    );

    assert.ok(
      response.body.ticket.statusHistory[0].changedAt
    );
    assert.equal(response.body.ticket.statusHistory[0].changedBy, "System Admin");
  });

  
it("should return dashboard analytics", async () => {
  await Ticket.create([
    {
      title: "Critical issue",
      description: "Critical test ticket",
      priority: "Critical",
      status: "Open",
      category: "Testing",
      createdBy: "Admin",
    },
    {
      title: "Resolved issue",
      description: "Resolved test ticket",
      priority: "High",
      status: "Resolved",
      category: "Testing",
      createdBy: "Admin",
    },
  ]);

  const response = await request(app).get("/api/analytics");

  assert.equal(response.status, 200);
  assert.equal(response.body.summary.totalTickets, 2);
  assert.equal(response.body.summary.openTickets, 1);
  assert.equal(response.body.summary.resolvedTickets, 1);
  assert.equal(response.body.summary.criticalTickets, 1);
  assert.ok(Array.isArray(response.body.statusCounts));
  assert.ok(Array.isArray(response.body.priorityCounts));
});


it("should filter dashboard analytics by date range", async () => {
  await Ticket.create([
    {
      title: "Recent ticket",
      description: "Ticket within date range",
      priority: "High",
      status: "Open",
      category: "Testing",
      createdBy: "Admin",
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
    },
    {
      title: "Older ticket",
      description: "Ticket outside date range",
      priority: "Critical",
      status: "Open",
      category: "Testing",
      createdBy: "Admin",
      createdAt: new Date("2026-01-15T10:00:00.000Z"),
    },
  ]);

  const response = await request(app).get(
    "/api/analytics?startDate=2026-06-01&endDate=2026-06-30"
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.summary.totalTickets, 1);
  assert.equal(response.body.summary.openTickets, 1);
  assert.equal(response.body.summary.criticalTickets, 0);
});






  it("requires login to create a ticket", async () => {
    const response = await request(app)
      .post("/api/tickets")
      .send({
        title: "Private ownership test",
        description: "Test",
        category: "Testing",
        priority: "Low",
      });
    assert.equal(response.status, 401);
  });

  it("allows a user to delete their own ticket but not another user's ticket", async () => {
    const owner = await createAuth("employee", "Ticket Owner");
    const other = await createAuth("employee", "Other User");
    const ticket = await Ticket.create({
      title: "Owned ticket",
      description: "Ownership check",
      priority: "Low",
      category: "Testing",
      createdBy: owner.user.name,
      createdByUserId: owner.user._id,
    });

    const denied = await request(app)
      .delete(`/api/tickets/${ticket._id}`)
      .set("Authorization", other.authorization);
    assert.equal(denied.status, 403);

    const allowed = await request(app)
      .delete(`/api/tickets/${ticket._id}`)
      .set("Authorization", owner.authorization);
    assert.equal(allowed.status, 200);
  });

  it("allows agents to update only tickets assigned to them", async () => {
    const agent = await createAuth("agent", "Priya Agent");
    const otherAgent = await createAuth("agent", "Other Agent");
    const ticket = await Ticket.create({
      title: "Assigned ticket",
      description: "Agent status permission",
      priority: "Medium",
      category: "Testing",
      createdBy: "Test User",
      assignee: "Priya Agent",
    });

    const allowed = await request(app)
      .patch(`/api/tickets/${ticket._id}/status`)
      .set("Authorization", agent.authorization)
      .send({ status: "In Progress" });
    assert.equal(allowed.status, 200);

    const anotherTicket = await Ticket.create({
      title: "Not assigned",
      description: "Should be forbidden",
      priority: "Medium",
      category: "Testing",
      createdBy: "Test User",
      assignee: "Someone Else",
    });

    const denied = await request(app)
      .patch(`/api/tickets/${anotherTicket._id}/status`)
      .set("Authorization", otherAgent.authorization)
      .send({ status: "In Progress" });
    assert.equal(denied.status, 403);
  });

  it("allows an admin to delete any ticket", async () => {
    const admin = await createAuth("admin", "System Admin");
    const ticket = await Ticket.create({
      title: "Any ticket",
      description: "Admin delete permission",
      priority: "Low",
      category: "Testing",
      createdBy: "Someone Else",
    });

    const response = await request(app)
      .delete(`/api/tickets/${ticket._id}`)
      .set("Authorization", admin.authorization);
    assert.equal(response.status, 200);
  });


  it("registers a standard user and prevents duplicate emails", async () => {
    const payload = {
      name: "Registered User",
      email: "registered@example.com",
      password: "Password123",
    };

    const created = await request(app).post("/api/auth/register").send(payload);
    assert.equal(created.status, 201);
    assert.equal(created.body.user.role, "employee");
    assert.ok(created.body.token);

    const duplicate = await request(app).post("/api/auth/register").send(payload);
    assert.equal(duplicate.status, 409);
  });

  it("allows a registered user to log in", async () => {
    await request(app).post("/api/auth/register").send({
      name: "Login User",
      email: "login-user@example.com",
      password: "Password123",
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "LOGIN-USER@example.com",
      password: "Password123",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.user.role, "employee");
    assert.ok(response.body.token);
  });


  it("provides active agent names to the assignee filter without exposing emails", async () => {
    await createAuth("agent", "Priya Agent");
    const response = await request(app).get("/api/users/agents/list");

    assert.equal(response.status, 200);
    assert.equal(response.body.agents.length, 1);
    assert.equal(response.body.agents[0].name, "Priya Agent");
    assert.equal(response.body.agents[0].email, undefined);
  });

  it("rejects invalid status filters", async () => {
    const response = await request(app).get("/api/tickets?status=Unknown");
    assert.equal(response.status, 400);
  });

  it("rejects an assignment to a name that is not an active agent", async () => {
    const admin = await createAuth("admin", "System Admin");
    const ticket = await Ticket.create({
      title: "Assignment validation",
      description: "Only active agents should be assigned",
      priority: "Medium",
      category: "Testing",
      createdBy: "System Admin",
    });

    const response = await request(app)
      .patch(`/api/tickets/${ticket._id}`)
      .set("Authorization", admin.authorization)
      .send({ assigneeUserId: "507f1f77bcf86cd799439011" });

    assert.equal(response.status, 400);
  });


  it("assigns tickets using an active agent database reference", async () => {
    const admin = await createAuth("admin", "System Admin");
    const agent = await createAuth("agent", "Priya Agent");
    const ticket = await Ticket.create({
      title: "Assign by reference",
      description: "The assignee should be linked to a user record",
      priority: "Medium",
      category: "Testing",
      createdBy: "System Admin",
    });

    const response = await request(app)
      .patch(`/api/tickets/${ticket._id}`)
      .set("Authorization", admin.authorization)
      .send({ assigneeUserId: agent.user._id.toString() });

    assert.equal(response.status, 200);
    assert.equal(response.body.ticket.assignee, "Priya Agent");
    assert.equal(response.body.ticket.assigneeUserId.toString(), agent.user._id.toString());
  });

});
