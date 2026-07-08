const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    const store = getStore("milestones");
    const cached = await store.get("sync-result", { type: "json" }).catch(() => null);

    if (!cached) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          members: [],
          synced_at: null,
          message: "Sync in progress, refresh in 60 seconds"
        }),
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
