export const access = "public";
export const methods = ["POST"];

function analyzeLocally(text) {
  // Split pasted chats that place several "Name: message" entries on one line.
  const normalizedText = text.replace(/\s+(?=[A-Z][A-Za-z0-9 _-]{0,40}:\s)/g, "\n");
  const lines = normalizedText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const actionWords = /\b(need to|needs to|must|please|don't forget|dont forget|remember to|deadline|due|finish|complete|send|submit|upload|prepare|review|meet|meeting|call|confirm|follow up|follow-up|blocked|waiting for|urgent|asap|by (monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|\d))/i;
  const decisionWords = /\b(agreed|decided|decision|final decision|we will|i will|i'll|let's|lets|confirmed|owner is|i can handle|i'll handle|moved to|changed to)\b/i;
  const deadlinePattern = /\b(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}(?::\d{2})?\s?(?:am|pm)|by the end of the day|eod|next week|this week)\b/i;
  const items = [];
  const decisions = [];
  const openQuestions = [];
  const seenDecisions = new Set();
  for (const line of lines) {
    const senderMatch = line.match(/^([^:]{1,50}):\s*/);
    const sender = senderMatch ? senderMatch[1].trim() : "Unknown";
    const content = line.replace(/^([^:]{1,50}):\s*/, "").trim();
    if (!content) continue;
    const hasDeadline = deadlinePattern.test(content);
    const isCompleted = /\b(done|completed|finished|already sent|already uploaded|has been sent|have sent|uploaded successfully|taken care of)\b/i.test(content);
    const isQuestion = /\?\s*$/.test(content) || /^(who|what|when|where|why|how|can|could|would|should|does|do|did|is|are|has|have|will)\b/i.test(content);
    // Polite requests phrased as questions are tasks, not unanswered discussion questions.
    const isRequest = /^(?:can|could|would|will)\s+(?:you|someone|anyone|we)\b/i.test(content) ||
      /\b(?:can|could you|please)\b.*\b(send|share|upload|prepare|review|confirm|check|finish|submit|call|meet|update|create|bring)\b/i.test(content);
    const isAction = actionWords.test(content);
    if (isQuestion && !isRequest && openQuestions.length < 8) {
      openQuestions.push({ title: content.length > 90 ? content.slice(0, 87) + "..." : content, detail: content, source: line, sender, status: "Needs an answer" });
    }
    if (isAction && !isCompleted && (!isQuestion || isRequest) && items.length < 8) {
      const urgent = /\b(urgent|asap|immediately|critical|overdue)\b/i.test(content);
      items.push({
        title: content.length > 90 ? content.slice(0, 87) + "..." : content,
        detail: content,
        source: line,
        sender,
        deadline: hasDeadline ? ((content.match(/\b(?:by|before|at)\s+\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i) || content.match(/\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i) || content.match(deadlinePattern) || ["Not stated"])[0]) : "Not stated",
        score: urgent ? 0.95 : hasDeadline ? 0.82 : 0.62,
        priority: urgent ? "Urgent" : hasDeadline ? "Action" : "Review"
      });
    }
    if (decisionWords.test(content) && decisions.length < 6) {
      const decisionKey = content.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!seenDecisions.has(decisionKey)) {
        seenDecisions.add(decisionKey);
        decisions.push({
          title: content.length > 90 ? content.slice(0, 87) + "..." : content,
          detail: content,
          source: line,
          kind: /\b(meet|meeting|tomorrow|monday|tuesday|wednesday|thursday|friday|at \d|moved to|changed to)\b/i.test(content) ? "Schedule update" : /\b(i will|i'll|i can handle|owner is)\b/i.test(content) ? "Ownership" : "Decision"
        });
      }
    }
  }
  const counts = new Map();
  for (const line of lines) {
    const match = line.match(/^([^:]{1,50}):/);
    if (match) counts.set(match[1].trim(), (counts.get(match[1].trim()) || 0) + 1);
  }
  const topics = [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,4).map(([name,count]) => ({name, count}));
  const recapParts = [];
  if (decisions.length) recapParts.push("Decisions or updates: " + decisions.slice(0, 2).map(d => d.detail).join(" "));
  if (items.length) recapParts.push("Pending actions: " + items.slice(0, 2).map(i => i.detail).join(" "));
  if (openQuestions.length) recapParts.push("Questions needing answers: " + openQuestions.slice(0, 2).map(q => q.detail).join(" "));
  const recap = recapParts.length ? recapParts.join(" ") : (lines.length ? "No clear actions, decisions, or open questions were detected. Review the source messages for context." : "No readable messages were found.");
  return { recap, items, decisions, topics, openQuestions };
}

export default async function (req, res) {
  const body = req.body || {};
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return res.status(400).json({ error: "Paste a conversation to analyze." });
  if (text.length > 50000) return res.status(413).json({ error: "Please keep conversations under 50,000 characters." });
  return res.json({ result: analyzeLocally(text), mode: "local", notice: "Free local rule-based analysis is active. It uses patterns, not a paid AI model, so review its suggestions." });
}