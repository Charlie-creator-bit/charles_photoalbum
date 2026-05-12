import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), "uploads");
  console.log(`Uploads directory: ${uploadsDir}`);
  if (!fs.existsSync(uploadsDir)) {
    console.log("Creating uploads directory...");
    fs.mkdirSync(uploadsDir);
  }

  // Configure Multer for local storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      console.log(`Saving file to: ${uploadsDir}`);
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const filename = file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname);
      console.log(`Generated filename: ${filename}`);
      cb(null, filename);
    },
  });

  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // API Routes
  app.post("/api/upload", (req, res) => {
    console.log("Upload request received");
    upload.array("files")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error("Multer error:", err);
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        console.error("Unknown error during upload:", err);
        return res.status(500).json({ error: "Server error during upload" });
      }

      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        console.warn("No files in request");
        return res.status(400).json({ error: "No files uploaded" });
      }
      
      const files = req.files as Express.Multer.File[];
      console.log(`${files.length} files uploaded successfully`);
      
      const urls = files.map(file => `/uploads/${file.filename}`);
      res.json({ urls });
    });
  });

  app.delete("/api/upload", (req, res) => {
    const { url } = req.body;
    if (!url || !url.startsWith("/uploads/")) {
      return res.status(400).json({ error: "Invalid file URL" });
    }

    const filename = url.replace("/uploads/", "");
    const filePath = path.join(uploadsDir, filename);

    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted file: ${filePath}`);
        res.json({ success: true });
      } catch (err) {
        console.error(`Error deleting file ${filePath}:`, err);
        res.status(500).json({ error: "Failed to delete file" });
      }
    } else {
      console.warn(`File not found for deletion: ${filePath}`);
      res.json({ success: true, message: "File already gone" });
    }
  });

  // Serve uploaded files statically
  app.use("/uploads", express.static(uploadsDir));

  // Vite middleware for development
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
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
