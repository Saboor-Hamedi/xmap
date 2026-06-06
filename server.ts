import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON
app.use(express.json());

// Initialize Gemini client lazily to avoid crashing on startup if API key is missing
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in your environment/secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Endpoint: AI Brainstorming
app.post("/api/ai/brainstorm", async (req: express.Request, res: express.Response) => {
  try {
    const { topic, parentTopic, customPrompt, currentSiblings } = req.body;
    
    if (!topic) {
       res.status(400).json({ error: "Missing required 'topic' parameter." });
       return;
    }

    const ai = getAiClient();
    
    const siblingContext = currentSiblings && currentSiblings.length > 0 
      ? `Existing related categories/sibling items are: ${currentSiblings.join(", ")}.` 
      : "";
    const parentContext = parentTopic ? `This is a child category under: "${parentTopic}".` : "";

    const userPromptText = `Generate 5-10 highly creative, logical, and specific subtopics or ideas for a mind map node titled: "${topic}".
${parentContext}
${siblingContext}
${customPrompt ? `Additional user guidance/instructions: "${customPrompt}"` : ""}
Provide each suggestion with a short, highly descriptive label (1-4 words) and optionally a brief note (1 sentence max) or priority ('high', 'medium', 'low').`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPromptText,
      config: {
        systemInstruction: "You are an expert brainstorming assistant, productivity coach, and mental mapping expert. You generate nested, structured, highly valuable thought flows for charts and mind maps. Respond strictly with structured JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["ideas"],
          properties: {
            ideas: {
              type: Type.ARRAY,
              description: "List of nested mind map topic ideas.",
              items: {
                type: Type.OBJECT,
                required: ["text"],
                properties: {
                  text: {
                    type: Type.STRING,
                    description: "The title of the mind map child node (1-4 words). Keep it concise, professional, and clear."
                  },
                  notes: {
                    type: Type.STRING,
                    description: "A very brief explanation or expanding note (max 1 sentence)."
                  },
                  priority: {
                    type: Type.STRING,
                    enum: ["high", "medium", "low", "none"],
                    description: "The estimated priority weight for this idea under the core topic."
                  }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text || "{}";
    const data = JSON.parse(resultText);
    res.json(data);
  } catch (err: any) {
    console.error("AI Brainstorming Error:", err);
    res.status(500).json({ error: err.message || "An error occurred during brainstorming." });
  }
});

// Endpoint: AI Quick Mind Map Generator (e.g. from scratch or full text summary)
app.post("/api/ai/generate-map", async (req: express.Request, res: express.Response) => {
  try {
    const { idea, description } = req.body;
    
    if (!idea) {
      res.status(400).json({ error: "Missing required 'idea' parameter." });
      return;
    }

    const ai = getAiClient();

    const userPromptText = `Create a fully developed, beautiful hierarchical mind map structure for the topic: "${idea}".
${description ? `Context/Detailed details about this topic to synthesize: "${description}"` : "Provide a comprehensive expansion with 3-4 main branches, and 3-5 sub-branches under each main branch."}
The output must be a nested tree structure starting from the central root topic. Max depth should be 3 levels.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPromptText,
      config: {
        systemInstruction: "You are an expert XMind architect. Structure complex topics into perfect hierarchal groupings. Ensure a highly organized layout. Return structured JSON.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "children"],
          properties: {
            title: {
              type: Type.STRING,
              description: "The central root idea title."
            },
            notes: {
              type: Type.STRING,
              description: "Brief central description note."
            },
            children: {
              type: Type.ARRAY,
              description: "Main branches connected to the root.",
              items: {
                type: Type.OBJECT,
                required: ["title"],
                properties: {
                  title: {
                    type: Type.STRING,
                    description: "Main branch topic."
                  },
                  notes: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ["high", "medium", "low", "none"] },
                  children: {
                    type: Type.ARRAY,
                    description: "Subtopics under this main branch.",
                    items: {
                      type: Type.OBJECT,
                      required: ["title"],
                      properties: {
                        title: { type: Type.STRING },
                        notes: { type: Type.STRING },
                        priority: { type: Type.STRING, enum: ["high", "medium", "low", "none"] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text || "{}";
    const data = JSON.parse(resultText);
    res.json(data);
  } catch (err: any) {
    console.error("AI Map Generation Error:", err);
    res.status(500).json({ error: err.message || "An error occurred during map generation." });
  }
});


// Register Vite or serve static files
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
