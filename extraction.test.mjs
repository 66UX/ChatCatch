import test from "node:test";
import assert from "node:assert/strict";
import app, { normalizeExtraction } from "../worker/index.js";

test("keeps an unclaimed task and excludes a cancelled one", () => {
  const source = "小林：车票还得买，谁来负责？\n小林：不租车了。";
  const result = normalizeExtraction({
    tasks: [{ title: "购买车票", owner: "", due: "", evidence: "小林：车票还得买，谁来负责？" }],
    excluded: [{ title: "租车", reason: "已取消", evidence: "小林：不租车了。" }],
    notes: [],
  }, source);
  assert.equal(result.tasks[0].owner, "待认领");
  assert.equal(result.tasks[0].due, "未提及");
  assert.deepEqual(result.tasks[0].review, []);
  assert.equal(result.excluded[0].reason, "已取消");
});

test("flags evidence the source does not contain", () => {
  const result = normalizeExtraction({
    tasks: [{ title: "订餐厅", owner: "阿泽", due: "周五", evidence: "阿泽：我来订餐厅" }],
    notes: [],
  }, "小林：周五前订餐厅。");
  assert.match(result.tasks[0].review[0], /原话未匹配/);
});

test("flags disputed responsibility and excludes cancelled tasks returned in tasks", () => {
  const result = normalizeExtraction({
    tasks: [
      { title: "买票", owner: "待确认", due: "", evidence: "小林：谁买票？" },
      { title: "租车", owner: "小林", due: "", evidence: "小林：不租车了。", state: "cancelled" },
    ],
    notes: [],
  }, "小林：谁买票？\n小林：不租车了。");
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].state, "unclear");
  assert.deepEqual(result.tasks[0].review, ["负责人有争议"]);
  assert.equal(result.excluded[0].title, "租车");
});

test("rejects malformed model data", () => {
  assert.throws(() => normalizeExtraction({ tasks: [{}], notes: [] }, ""));
});

test("API returns normalized structured output", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      tasks: [{ title: "购买车票", owner: "未指定", due: "", evidence: "小林：车票还得买。" }],
      excluded: [],
      notes: [],
    }) } }],
  }));
  try {
    const response = await app.fetch(new Request("http://localhost/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": "sk-test" },
      body: JSON.stringify({ text: "小林：车票还得买。" }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.tasks[0].owner, "待认领");
    assert.deepEqual(body.tasks[0].review, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
