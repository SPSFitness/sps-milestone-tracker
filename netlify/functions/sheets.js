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

  try {
    const store = getStore({
      name: "milestones",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });

    if (event.httpMethod === "GET") {
      let existing = {};
      try {
        const raw = await store.get("celebrated");
        if (raw) existing = JSON.parse(raw);
      } catch(e) {
        console.log("No celebrated data yet:", e.message);
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ records: existing }),
      };
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { name, milestone, celebrated_by, notes } = body;

      if (!name || !milestone) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing name or milestone" }) };
      }

      let existing = {};
      try {
        const raw = await store.get("celebrated");
        if (raw) existing = JSON.parse(raw);
      } catch(e) {
        console.log("Starting fresh celebrated store");
      }

      const key = `${name}|${milestone}`;
      const date = new Date().toLocaleDateString("en-GB");
      existing[key] = { name, milestone, date, by: celebrated_by || "SPS", notes: notes || "" };

      const toSave = JSON.stringify(existing);
      console.log("Saving celebrated:", toSave);
      await store.set("celebrated", toSave);
      console.log("Saved successfully");

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, date }),
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  } catch (err) {
    console.error("sheets error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
