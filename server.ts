import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { networkInterfaces } from "os";
import "dotenv/config";
import admin from "firebase-admin";
import fs from "fs";

// Initialize Firebase Admin SDK
let firestoreDb: admin.firestore.Firestore | null = null;

// Helper to format/fix common copy-pasted private key formats
const cleanPrivateKey = (key: string): string => {
  let cleaned = key.trim();
  
  // Remove wrapping quotes
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  }
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }

  // De-escape any backslash-n combinations
  cleaned = cleaned.replace(/\\n/g, '\n');

  // If the key body is already wrapped in correct PEM delimiters, return it
  if (cleaned.includes("-----BEGIN PRIVATE KEY-----") && cleaned.includes("-----END PRIVATE KEY-----")) {
    return cleaned;
  }
  if (cleaned.includes("-----BEGIN RSA PRIVATE KEY-----") && cleaned.includes("-----END RSA PRIVATE KEY-----")) {
    return cleaned;
  }

  // If delimiters are missing, let's strip whitespace and reconstruct a standard PKCS#8 PEM format
  const base64Body = cleaned.replace(/\s+/g, "");
  const lines: string[] = [];
  for (let i = 0; i < base64Body.length; i += 64) {
    lines.push(base64Body.slice(i, i + 64));
  }
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
};

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let databaseId = "ai-studio-1ccc76f9-c08f-414e-bf10-638a70824f8c";
  let fallbackProjectId = "gen-lang-client-0410187942";
  
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (config.firestoreDatabaseId) {
      databaseId = config.firestoreDatabaseId;
    }
    if (config.projectId) {
      fallbackProjectId = config.projectId;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || fallbackProjectId;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  let initialized = false;

  if (projectId && clientEmail && privateKey) {
    try {
      const formattedKey = cleanPrivateKey(privateKey);
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: formattedKey,
        }),
      });
      initialized = true;
      console.log("Firebase Admin successfully initialized via explicit service account parameters.");
    } catch (certError) {
      console.warn("Failed to initialize Firebase Admin with service account. Falling back to default initialization...", certError);
    }
  }

  if (!initialized) {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: projectId || undefined,
      });
      console.log("Firebase Admin initialized using default client configuration.");
    }
  }

  // Gracefully attempt to load premium database interface, catching credentials error
  try {
    firestoreDb = admin.firestore(databaseId);
    console.log(`Firebase Firestore Service registered targeting database: ${databaseId}`);
  } catch (fsError) {
    console.warn(`[DEVELOPMENT] Firestore Admin Client cannot connect to GCloud: ${fsError instanceof Error ? fsError.message : String(fsError)}. Form will save locally.`);
  }
} catch (error) {
  console.error("Critical error during Firebase bootstrapping initialization:", error);
}

// Input sanitation helper function
const sanitizeInput = (str: string, maxLength: number): string => {
  if (!str) return "";
  return str
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // removes non-printable ASCII/control chars
    .slice(0, maxLength); // strict length boundary
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for rate limiting behind Cloud Run/Nginx
  app.set('trust proxy', 1);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Vite needs some flexibility in dev
    crossOriginEmbedderPolicy: false,
  }));

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: "Too many requests from this IP, please try again after 15 minutes"
  });
  app.use("/api/", limiter);

  app.use(express.json());

  // API Route for Contact Form (Firebase-Admin & Telegram Integrations)
  app.post("/api/contact", async (req, res) => {
    const { name, email, message, company, service, honeypot } = req.body;
    
    // Honeypot check on server
    if (honeypot) {
      console.warn("Bot detected via honeypot on server");
      return res.json({ success: true }); // Fake success
    }

    // Sanitize input fields
    const sanitizedName = sanitizeInput(name || '', 100);
    const sanitizedEmail = sanitizeInput(email || '', 100);
    const sanitizedCompany = sanitizeInput(company || '', 100); // project type
    const sanitizedService = sanitizeInput(service || '', 100); // budget
    const sanitizedMessage = sanitizeInput(message || '', 2000);

    // Basic validation
    if (!sanitizedName || !sanitizedEmail || !sanitizedMessage) {
      return res.status(400).json({ error: "Required fields are missing or invalid." });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitizedEmail)) {
      return res.status(400).json({ error: "Invalid email format." });
    }

    let dbSaved = false;
    let dbWarning = "";

    // 1. Secure Firestore Write from Backend
    if (firestoreDb) {
      try {
        const timestamp = Date.now().toString(36);
        const fileSafeName = sanitizedName.replace(/[^a-z0-9а-яё]/gi, '_').toLowerCase();
        const customId = `${fileSafeName}-${timestamp}`;

        console.log(`Saving contact request to Firestore on server with ID: ${customId}`);
        await firestoreDb.collection('contact_requests').doc(customId).set({
          name: sanitizedName,
          email: sanitizedEmail,
          projectType: sanitizedCompany,
          budget: sanitizedService,
          message: sanitizedMessage,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        dbSaved = true;
      } catch (firestoreError) {
        console.error("Backend Firestore Save Error:", firestoreError);
        dbWarning = "Saving request to Firestore failed on the server.";
      }
    } else {
      console.warn("Firestore Admin not initialized; skipping DB persistent write.");
      dbWarning = "Firebase Admin keys are missing; persistent Firestore write was skipped.";
    }

    // 2. Send to Telegram Notification
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    // Log submission to stdout for frictionless local debugging
    console.log(`\n📬 [CONTACT FORM SUBMISSION RECEIVED]
=========================================
• Name: ${sanitizedName}
• Email: ${sanitizedEmail}
• Project Type: ${sanitizedCompany || 'NoneSpecified'}
• Budget: ${sanitizedService || 'NoneSpecified'}
• Message: ${sanitizedMessage}
• DB Saved: ${dbSaved ? "YES ✅" : "NO ❌"}
=========================================\n`);

    if (!botToken || !chatId) {
      console.warn("Telegram integration not configured. Form save succeeded, but notify skipped.");
      return res.json({ 
        success: true, 
        dbSaved, 
        warning: dbWarning ? `${dbWarning} Also, Telegram token is omitted.` : "Telegram token omitted." 
      });
    }

    // Escape HTML special characters to prevent Telegram API errors in HTML mode
    const escapeHTML = (str: string) => {
      if (!str) return '';
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    };

    const safeName = escapeHTML(sanitizedName);
    const safeEmail = escapeHTML(sanitizedEmail);
    const safeCompany = escapeHTML(sanitizedCompany || 'Не указано');
    const safeService = escapeHTML(sanitizedService || 'Не указано');
    const safeMessage = escapeHTML(sanitizedMessage);

    const text = `<b>Новая заявка</b>\n\n` +
                 `• <b>Имя:</b> ${safeName}\n` +
                 `• <b>Email:</b> ${safeEmail}\n` +
                 `• <b>Тип проекта:</b> ${safeCompany}\n` +
                 `• <b>Бюджет:</b> ${safeService}\n\n` +
                 `<b>Сообщение:</b>\n${safeMessage}`;

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
        }),
      });

      if (response.ok) {
        res.json({ success: true });
      } else {
        const errorData = await response.json();
        console.error("Telegram API Error:", errorData);
        res.status(500).json({ error: "Form saved but Telegram notification failed to send" });
      }
    } catch (error) {
      console.error("Telegram Notification Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    const nets = networkInterfaces();
    let networkUrl = '';
    
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]!) {
        // Find IPv4 address that is not internal
        if (net.family === 'IPv4' && !net.internal) {
          networkUrl = `http://${net.address}:${PORT}`;
          break;
        }
      }
    }

    console.log(`\n  🚀 Server is running!`);
    console.log(`  > Local:    http://localhost:${PORT}`);
    if (networkUrl) {
      console.log(`  > Network:  ${networkUrl}\n`);
    }
  });
}

startServer();
