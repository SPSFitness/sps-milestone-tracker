const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const store = getStore({
      name: "milestones",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });

    const raw = await store.get("sync-result").catch(() => null);
    const cached = raw ? JSON.parse(raw) : null;

    if (!cached) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ members: [], synced_at: null, message: "Sync in progress, refresh in 60 seconds" }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(cached),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
