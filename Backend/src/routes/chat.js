import { Router } from "express";
import { rateLimit } from "../middleware/rateLimit.js";
import { generateChatResponse } from "../services/llmClient.js";

const router = Router();

// POST /v1/chat
router.post(
  "/",
  rateLimit("chat"), // Rate limit hard (8-10 req/min per IP should be configured in Upstash)
  async (req, res) => {
    try {
      let { message, history } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required and must be a string." });
      }

      // Cap message length (quota protection)
      if (message.length > 1000) {
        message = message.substring(0, 1000);
      }

      // Validate and cap history
      if (!Array.isArray(history)) {
        history = [];
      }
      
      // Cap history to last 6-8 turns to keep token usage low
      if (history.length > 8) {
        history = history.slice(-8);
      }

      // Basic validation of history elements
      const validHistory = history.filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      );

      const result = await generateChatResponse(message, validHistory);

      // Return plain text
      return res.status(200).json(result);
    } catch (err) {
      console.error("[Chat] Error:", err.message);
      return res.status(503).json({
        error: "The chat service is temporarily unavailable. Please try again later.",
      });
    }
  }
);

export default router;
