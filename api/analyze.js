export const access = "public";
export const methods = ["POST"];

function analyzeLocally(text) {
  // Split pasted chats that place several "Name: message" entries on one line.
  const normalizedText = text.replace(/\s+(?=[A-Z][A-Za-z0-9 _-]{0,40}:\s)/g, "\n");
  const lines = normalizedText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const actionWords = /\b(need to|needs to|must|please|don't forget|dont forget|remember to|deadline|due|finish|complete|send|submit|upload|prepare|review|meet|meeting|call|confirm|follow up|follow-up|blocked|waiting for|urgent|asap|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|\d))/i;
  const decisionWords = /\b(agreed|decided|decision|we will|i will|i'll|let's|lets|confirmed|owner is|i can handle|i'll handle)\b/i;
  const deadlinePattern = /\b(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s?(?:am|pm)|by the end of the day|eod|next week|this week)\b/i;
  const items = [];
  const decisions = [];
  for (const line of lines) {
    const senderMatch = line.match(/^([^:]{1,50}):\s*/);
    const sender = senderMatch ? senderMatch[1].trim() : "Unknown";
    const content = line.replace(/^([^:]{1,50}):\s*/, "").trim();
    if (!content) continue;
    const hasDeadline = deadlinePattern.test(content);
    const isCompleted = /\b(done|completed|finished|already sent|already uploaded|has been sent|have sent|uploaded successfully|taken care of)\b/i.test(content);
    const isQuestion = /\?\s*$/.test(content);
    const isAction = actionWords.test(content);
    if (isAction && !isCompleted && !isQuestion && items.length < 8) {
      const urgent = /\b(urgent|asap|immediately|critical|overdue)\b/i.test(content);
      items.push({
        title: content.length > 90 ? content.slice(0, 87) + "..." : content,
        detail: content,
        source: line,
        sender,
        deadline: hasDeadline ? (content.match(deadlinePattern) || ["Not stated"])[0] : "Not stated",
        score: urgent ? 0.95 : hasDeadline ? 0.82 : 0.62,
        priority: urgent ? "Urgent" : hasDeadline ? "Action" : "Review"
      });
    }
    if (decisionWords.test(content) && decisions.length < 6) {
      decisions.push({
        title: content.length > 90 ? content.slice(0, 87) + "..." : content,
        detail: content,
        source: line,
        kind: /\b(meet|meeting|tomorrow|monday|tuesday|wednesday|thursday|friday|at \d)/i.test(content) ? "Schedule update" : /\b(i will|i'll|i can handle|owner is)\b/i.test(content) ? "Ownership" : "Decision"
      });
    }
  }
  const counts = new Map();
  for (const line of lines) {
    const match = line.match(/^([^:]{1,50}):/);
    if (match) counts.set(match[1].trim(), (counts.get(match[1].trim()) || 0) + 1);
  }
  const topics = [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,4).map(([name,count]) => ({name, count}));
  const recapLines = lines.slice(0, 4).map(s => s.length > 180 ? s.slice(0,177)+"..." : s);
  const recap = lines.length
    ? "Rule-based recap (not generative AI): " + recapLines.join(" ") + (lines.length > 4 ? " …" : "")
    : "No readable messages were found.";
  return { recap, items, decisions, topics };
}

export default async function (req, res) {
  const body = req.body || {};
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "Paste a conversation to analyze." });
  if (text.length > 50000) return res.status(413).json({ error: "Please keep conversations under 50,000 characters." });
  return res.json({ result: analyzeLocally(text), mode: "local", notice: "Free local rule-based analysis is active. It uses patterns, not a paid AI model, so review its suggestions." });
}