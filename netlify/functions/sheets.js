const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const store = getStore("milestones");

  try {
    // GET — return all celebrated milestones
    if (event.httpMethod === "GET") {
      const existing = await store.get("celebrated", { type: "json" }).catch(() => ({}));
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ records: existing || {} }),
      };
    }

    // POST — mark a milestone as celebrated
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { name, milestone, celebrated_by, notes } = body;

      if (!name || !milestone) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing name or milestone" }) };
      }

      const existing = await store.get("celebrated", { type: "json" }).catch(() => ({}));
      const key = `${name}|${milestone}`;
      const date = new Date().toLocaleDateString("en-GB");

      existing[key] = {
        name,
        milestone,
        date,
        by: celebrated_by || "SPS",
        notes: notes || "",
      };

      await store.setJSON("celebrated", existing);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, date }),
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
