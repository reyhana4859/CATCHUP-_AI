import { db } from "hatchable";

export const access = "public";
export const methods = ["POST"];

function validUuid(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validOwnerKey(value) {
  return validUuid(value);
}

export default async function (req, res) {
  const body = req.body || {};
  const ownerKey = body.ownerKey;
  const action = body.action;
  if (!validOwnerKey(ownerKey)) return res.status(400).json({ error: "A valid private workspace key is required." });

  try {
    if (action === "save") {
      const briefing = body.briefing;
      if (!briefing || typeof briefing !== "object" || Array.isArray(briefing) ||
          !Array.isArray(briefing.items) || !Array.isArray(briefing.decisions) ||
          !Array.isArray(briefing.topics)) {
        return res.status(400).json({ error: "A valid briefing is required." });
      }
      if (briefing.items.length > 100 || briefing.decisions.length > 100 || briefing.topics.length > 100) {
        return res.status(413).json({ error: "This briefing contains too many extracted items." });
      }
      let serialized;
      try {
        serialized = JSON.stringify(briefing);
      } catch {
        return res.status(400).json({ error: "The briefing must be valid JSON data." });
      }
      if (typeof serialized !== "string" || serialized.length > 200000) {
        return res.status(413).json({ error: "This briefing is too large to save." });
      }
      const title = String(body.title || "Conversation briefing").slice(0, 120);
      const recap = String(briefing.recap || "").slice(0, 2000);
      const result = await db.query(
        "INSERT INTO saved_briefings (owner_key, title, recap, briefing) VALUES ($1, $2, $3, $4::jsonb) RETURNING id, title, recap, created_at",
        [ownerKey, title, recap, serialized]
      );
      return res.status(201).json({ saved: result.rows[0] });
    }

    if (action === "list") {
      const result = await db.query(
        "SELECT id, title, recap, created_at FROM saved_briefings WHERE owner_key = $1 ORDER BY created_at DESC LIMIT 50",
        [ownerKey]
      );
      return res.json({ briefings: result.rows || [] });
    }

    if (action === "get") {
      const id = body.id;
      if (!validUuid(id)) return res.status(400).json({ error: "A valid briefing ID is required." });
      const result = await db.query(
        "SELECT id, title, recap, briefing, created_at FROM saved_briefings WHERE owner_key = $1 AND id = $2 LIMIT 1",
        [ownerKey, id]
      );
      if (!result.rows || !result.rows.length) return res.status(404).json({ error: "Saved briefing not found." });
      return res.json({ saved: result.rows[0] });
    }

    if (action === "delete") {
      const id = body.id;
      if (!validUuid(id)) return res.status(400).json({ error: "A valid briefing ID is required." });
      await db.query(
        "DELETE FROM saved_briefings WHERE owner_key = $1 AND id = $2",
        [ownerKey, id]
      );
      return res.json({ deleted: true });
    }

    return res.status(400).json({ error: "Unsupported action. Use save, list, get, or delete." });
  } catch (err) {
    console.log("Saved briefing database operation failed", String(err && err.message || err));
    return res.status(500).json({ error: "The database could not complete that request." });
  }
}