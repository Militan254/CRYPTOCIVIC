import { strict as assert } from "node:assert";
import request from "supertest";
import { after, describe, it } from "mocha";
import { createAuthToken, createVoterToken } from "../backend/services/auth.js";
import { pool } from "../backend/config/database.js";

process.env.NODE_ENV = "test";

const { app } = await import("../backend/server.js");

after(async function () {
  await pool.end();
});

describe("backend route protection", function () {
  it("requires authentication for administrator management", async function () {
    const response = await request(app).get("/api/admins");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
  });

  it("requires voter authentication before casting a vote", async function () {
    const response = await request(app)
      .post("/api/votes")
      .send({ election_id: 1, candidate_id: 1 });

    assert.equal(response.status, 401);
    assert.equal(response.body.message, "Voter authentication required");
  });

  it("requires voter authentication before candidate submission", async function () {
    const response = await request(app)
      .post("/api/candidates/register")
      .field("election_id", "1");

    assert.equal(response.status, 401);
    assert.equal(response.body.message, "Voter authentication required");
  });

  it("requires voter authentication for student lookup", async function () {
    const response = await request(app).get("/api/students/TEST001");

    assert.equal(response.status, 401);
    assert.equal(response.body.message, "Voter authentication required");
  });

  it("requires voter authentication for private candidate status", async function () {
    const response = await request(app).get("/api/candidates/mine");

    assert.equal(response.status, 401);
    assert.equal(response.body.message, "Voter authentication required");
  });

  it("requires super-admin authentication for the God-mode overview", async function () {
    const response = await request(app).get("/api/admins/overview");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
  });

  it("rejects an ordinary admin from the God-mode overview", async function () {
    const [rows] = await pool.query(
      "SELECT admin_id FROM administrators WHERE role = 'ADMIN' LIMIT 1"
    );
    const ordinaryAdmin = (rows as Array<{ admin_id: number }>)[0];

    if (!ordinaryAdmin) {
      this.skip();
      return;
    }

    const token = createAuthToken({ adminId: ordinaryAdmin.admin_id, role: "ADMIN" });
    const response = await request(app)
      .get("/api/admins/overview")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 403);
    assert.equal(response.body.message, "Super administrator privileges required");
  });

  it("rejects a voter token when the URL registration differs", async function () {
    const token = createVoterToken({
      studentId: 1,
      registrationNumber: "TEST001",
    });
    const response = await request(app)
      .get("/api/elections/eligible/OTHER001")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(response.status, 403);
    assert.equal(
      response.body.message,
      "Election request does not match the signed-in voter"
    );
  });

  it("rejects candidate applications without the required multipart files", async function () {
    const token = createVoterToken({
      studentId: 1,
      registrationNumber: "TEST001",
    });
    const response = await request(app)
      .post("/api/candidates/register")
      .set("Authorization", `Bearer ${token}`)
      .field("election_id", "1");

    assert.notEqual(response.status, 401);
    assert.equal(response.body.success, false);
  });

  it("protects manual election activation behind admin authentication", async function () {
    const response = await request(app)
      .patch("/api/elections/1/activate");

    assert.equal(response.status, 401);
    assert.equal(response.body.success, false);
  });
});
