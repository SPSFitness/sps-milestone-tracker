const fetch = require("node-fetch");

exports.handler = async (event) => {
  const { code, state } = event.queryStringParameters || {};

  if (!code) {
    return { statusCode: 400, body: "No code provided" };
  }

  try {
    // Retrieve code_verifier from state (we stored it base64 encoded)
    let codeVerifier = "";
    try {
      codeVerifier = Buffer.from(state || "", "base64").toString("utf8");
    } catch (e) {}

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.GTU_REDIRECT_URI,
      client_id: process.env.GTU_CLIENT_ID,
      client_secret: process.env.GTU_CLIENT_SECRET,
      code_verifier: codeVerifier,
    });

    const res = await fetch("https://goteamup.com/api/v2/auth/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    const cookieValue = Buffer.from(JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + 7200 * 1000, // 2 hours
    })).toString("base64");

    return {
      statusCode: 302,
      headers: {
        Location: "/",
        "Set-Cookie": `gtu_token=${cookieValue}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`,
      },
      body: "",
    };
  } catch (err) {
    console.error("OAuth callback error:", err);
    return {
      statusCode: 302,
      headers: { Location: "/?error=" + encodeURIComponent(err.message) },
      body: "",
    };
  }
};
