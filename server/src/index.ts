import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createDataLoaders } from './dataloaders';

dotenv.config();

// Always prefer SQLite for this app. Ignores expired/unreachable Render Postgres URLs.
const postgresUrl = process.env.DATABASE_URL && /postgres|dpg-/i.test(process.env.DATABASE_URL);
const onRender = process.env.RENDER === 'true' || fs.existsSync('/data');
if (onRender || postgresUrl) {
  const diskDir = onRender ? '/data' : path.join(__dirname, '../prisma/data');
  try { fs.mkdirSync(diskDir, { recursive: true }); } catch { /* ignore */ }
  process.env.DATABASE_URL = onRender ? 'file:/data/prod.db' : `file:${path.join(diskDir, 'prod.db').replace(/\\/g, '/')}`;
  console.log('[db] Using SQLite at', process.env.DATABASE_URL);
}

const prisma = new PrismaClient();
const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
const PORT = process.env.PORT || 4000;

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_12345';

function getRequestIp(req: { ip?: string }) {
  return (req.ip || 'unknown').replace(/^::ffff:/, '');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for GraphQL playground
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and documents are allowed.'));
    }
  }
});

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production, allow any vercel.app subdomain + the explicit CLIENT_URL.
// In development, allow everything.
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile, curl, Postman, SSR)
    if (!origin) return callback(null, true);

    // Development — allow all
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    const allowed = [
      // Explicit production URL set in Render env vars
      process.env.CLIENT_URL,
      // Allow all vercel.app subdomains automatically
    ].filter(Boolean) as string[];

    // Allow any *.vercel.app origin (covers preview deployments too)
    if (
      origin.endsWith('.vercel.app') ||
      allowed.includes(origin) ||
      origin === 'http://localhost:5173' ||
      origin === 'http://localhost:4173'
    ) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(null, false); // silently reject instead of throwing
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Apply CORS before route-specific middleware so preflight responses always
// include the required Access-Control-Allow-* headers.
app.use(cors(corsOptions));
app.options('/graphql', cors(corsOptions));
app.use('/graphql', limiter);
app.use('/upload', limiter);

app.use(express.json({ limit: '10mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── File upload endpoint ──────────────────────────────────────────────────────
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const authHeader = req.headers.authorization || '';
    let user = null;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        user = jwt.verify(token, JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { entityType, entityId, description, category, expiryDate, isConfidential, accessLevel } = req.body;

    const document = await prisma.document.create({
      data: {
        entityType: entityType || 'GENERAL',
        entityId: entityId || null,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.filename,
        uploadedBy: user.id,
        description: description || null,
        category: category || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isConfidential: isConfidential === 'true',
        accessLevel: accessLevel || 'INTERNAL',
      },
    });

    res.json({ 
      success: true, 
      document: {
        id: document.id,
        fileName: document.fileName,
        fileType: document.fileType,
        fileSize: document.fileSize,
        downloadUrl: `/download/${document.id}`,
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── File download endpoint ────────────────────────────────────────────────────
app.get('/download/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    let user = null;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        user = jwt.verify(token, JWT_SECRET);
      } catch {
        // Continue without user for public documents
      }
    }

    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access level
    if (document.accessLevel === 'RESTRICTED' && !user) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (document.accessLevel === 'CONFIDENTIAL' && (!user || user.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.join(uploadsDir, document.filePath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, document.fileName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

// ── List documents endpoint ───────────────────────────────────────────────────
app.get('/documents', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    let user = null;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        user = jwt.verify(token, JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { entityType, entityId } = req.query;
    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    const documents = await prisma.document.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
    });

    res.json({ 
      documents: documents.map(doc => ({
        id: doc.id,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        entityType: doc.entityType,
        entityId: doc.entityId,
        description: doc.description,
        category: doc.category,
        accessLevel: doc.accessLevel,
        uploadedAt: doc.uploadedAt,
        downloadUrl: `/download/${doc.id}`,
      }))
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// ── Delete document endpoint ──────────────────────────────────────────────────
app.delete('/documents/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    let user = null;
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        user = jwt.verify(token, JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file from disk
    const filePath = path.join(uploadsDir, document.filePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// ── Monitoring endpoints ────────────────────────────────────────────────────
app.get('/metrics', (_req, res) => {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };
  res.json(metrics);
});

app.get('/status', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    const status = {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── Monitoring endpoints ────────────────────────────────────────────────────
app.get('/metrics', (_req, res) => {
  const metrics = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  };
  res.json(metrics);
});

app.get('/status', async (_req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    const status = {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── GraphQL ───────────────────────────────────────────────────────────────────

async function ensureDatabaseReady() {
  const { execSync } = await import('child_process');
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
  } catch {
    console.log('[db] Schema missing — running prisma db push…');
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'inherit',
      env: process.env,
    });
  }

  try {
    const users = await prisma.user.count();
    if (users === 0) {
      console.log('[db] No users — running seed…');
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env: process.env });
    }
  } catch (e: any) {
    console.warn('[db] Seed check failed:', e?.message || e);
    try {
      execSync('npx prisma db push --accept-data-loss --skip-generate', {
        stdio: 'inherit',
        env: process.env,
      });
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env: process.env });
    } catch (seedErr: any) {
      console.error('[db] Auto-seed failed:', seedErr?.message || seedErr);
    }
  }
}

async function startServer() {
  await ensureDatabaseReady();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: false, // disabled — client uses Bearer token auth, not cookies
  });

  await server.start();

  app.get('/graphql', cors<cors.CorsRequest>(corsOptions), (_req, res) => {
    res.json({
      status: 'ok',
      message: 'GraphQL endpoint is running. Send GraphQL queries with POST.',
      endpoint: '/graphql',
      example: {
        query: '{ __typename }',
      },
    });
  });

  app.use(
    '/graphql',
    cors<cors.CorsRequest>(corsOptions),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Get user from token
        const token = req.headers.authorization?.replace('Bearer ', '');
        let user = null;
        
        if (token) {
          try {
            user = jwt.verify(token, JWT_SECRET);
          } catch (error) {
            console.warn('Invalid token:', error);
          }
        }

        // Create DataLoaders for this request
        const loaders = createDataLoaders(prisma);

        return {
          prisma,
          user,
          requestIp: getRequestIp(req),
          loaders,
        };
      },
    }),
  );

  // Start the Express server
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
    console.log(`✅ Database: Connected`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
