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
import { depthLimit } from './graphql/depthLimit';
import { specifiedRules } from 'graphql';

dotenv.config();

// ── JWT Secret — fail fast if not set in production ───────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET environment variable is not set. Refusing to start in production.');
    process.exit(1);
  } else {
    console.warn('[WARN] JWT_SECRET is not set. Using an insecure development default. Set JWT_SECRET before deploying.');
  }
}
// Safe to cast — we've either exited or warned. Use a non-empty fallback for dev only.
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'dev_only_insecure_secret_do_not_use_in_production';

// ── Database path resolution ──────────────────────────────────────────────────
// Always prefer SQLite for this app. Ignores expired/unreachable Render Postgres URLs.
const postgresUrl = process.env.DATABASE_URL && /postgres|dpg-/i.test(process.env.DATABASE_URL);
const onRender = process.env.RENDER === 'true' || fs.existsSync('/data');
if (onRender || postgresUrl) {
  const diskDir = onRender ? '/data' : path.join(__dirname, '../prisma/data');
  try { fs.mkdirSync(diskDir, { recursive: true }); } catch { /* ignore */ }
  process.env.DATABASE_URL = onRender
    ? 'file:/data/prod.db'
    : `file:${path.join(diskDir, 'prod.db').replace(/\\/g, '/')}`;
  console.log('[db] Using SQLite at', process.env.DATABASE_URL);
}

const prisma = new PrismaClient();
const app = express();
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
const PORT = process.env.PORT || 4000;

function getRequestIp(req: { ip?: string }): string {
  return (req.ip || 'unknown').replace(/^::ffff:/, '');
}

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled — GraphQL clients send POST without form tokens
  crossOriginEmbedderPolicy: false,
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth and upload endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const mutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 80,
  message: 'Too many mutations from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

function graphqlMutationGate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const query = typeof (req.body as { query?: string } | undefined)?.query === 'string'
    ? (req.body as { query: string }).query
    : '';
  if (/\bmutation\b/i.test(query)) {
    return mutationLimiter(req, res, next);
  }
  return next();
}

// ── Uploads directory ─────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Multer configuration ──────────────────────────────────────────────────────
// Whitelist both extensions AND MIME types precisely to prevent bypass attacks.
const ALLOWED_MIMETYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpeg', '.jpg', '.png', '.gif',
  '.pdf', '.doc', '.docx',
  '.xls', '.xlsx', '.csv', '.txt',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMETYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Disallowed file type: ${file.mimetype} (${ext}). Allowed: images, PDF, Office docs, CSV, TXT.`));
    }
  },
});

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow no-origin (mobile, curl, Postman)
    if (process.env.NODE_ENV !== 'production') return callback(null, true); // Dev: allow all

    const explicitAllowed = [process.env.CLIENT_URL].filter(Boolean) as string[];

    if (
      origin.endsWith('.vercel.app') ||
      explicitAllowed.includes(origin) ||
      origin === 'http://localhost:5173' ||
      origin === 'http://localhost:4173'
    ) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('/graphql', cors(corsOptions));
app.use('/graphql', generalLimiter);
app.use('/upload', strictLimiter);

app.use(express.json({ limit: '10mb' }));

// ── Helper: extract and verify JWT from request ───────────────────────────────
function extractUser(authHeader: string): jwt.JwtPayload | null {
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    return typeof decoded === 'object' ? decoded : null;
  } catch {
    return null;
  }
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Metrics ───────────────────────────────────────────────────────────────────
app.get('/metrics', (_req, res) => {
  res.json({
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── Status (DB connectivity check) ───────────────────────────────────────────
app.get('/status', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    });
  } catch {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ── File upload endpoint ──────────────────────────────────────────────────────
app.post('/upload', strictLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const user = extractUser(req.headers.authorization || '');
    if (!user) {
      // Remove the uploaded file since the request is unauthorized
      fs.unlink(path.join(uploadsDir, req.file.filename), () => {});
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { entityType, entityId, description, category, expiryDate, isConfidential, accessLevel } = req.body as Record<string, string>;

    const document = await prisma.document.create({
      data: {
        entityType: entityType || 'GENERAL',
        entityId: entityId || null,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.filename,
        uploadedBy: user['id'] as string,
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
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// ── File download endpoint ────────────────────────────────────────────────────
app.get('/download/:id', async (req, res) => {
  try {
    const user = extractUser(req.headers.authorization || '');

    const document = await prisma.document.findUnique({
      where: { id: req.params['id'] },
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Access control by level
    if (document.accessLevel === 'RESTRICTED' && !user) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (document.accessLevel === 'INTERNAL' && !user) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (document.accessLevel === 'CONFIDENTIAL' && (!user || user['role'] !== 'ADMIN')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.join(uploadsDir, document.filePath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
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
    const user = extractUser(req.headers.authorization || '');
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { entityType, entityId } = req.query as Record<string, string | undefined>;
    const where: Record<string, unknown> = {};
    if (entityType) where['entityType'] = entityType;
    if (entityId) where['entityId'] = entityId;

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
      })),
    });
  } catch (error) {
    console.error('List documents error:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// ── Delete document endpoint ──────────────────────────────────────────────────
app.delete('/documents/:id', async (req, res) => {
  try {
    const user = extractUser(req.headers.authorization || '');
    if (!user || user['role'] !== 'ADMIN') {
      return res.status(403).json({ error: 'Access denied — ADMIN role required' });
    }

    const document = await prisma.document.findUnique({
      where: { id: req.params['id'] },
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.join(uploadsDir, document.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.document.delete({ where: { id: req.params['id'] } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Delete failed' });
  }
});

function sqliteFilePath(): string | null {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('file:')) {
    const raw = url.slice('file:'.length);
    if (path.isAbsolute(raw) || raw.startsWith('/data/')) return raw;
    return path.resolve(__dirname, '..', raw.replace(/^\.\//, ''));
  }
  const candidates = [
    path.join(__dirname, '../prisma/dev.db'),
    path.join(__dirname, '../prisma/data/prod.db'),
    '/data/prod.db',
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

app.get('/admin/backup', strictLimiter, (req, res) => {
  const user = extractUser(req.headers.authorization || '');
  if (!user || user['role'] !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin only' });
  }
  const dbPath = sqliteFilePath();
  if (!dbPath || !fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'SQLite database file not found' });
  }
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="storeos-backup-${stamp}.db"`);
  fs.createReadStream(dbPath).pipe(res);
});

const restoreUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, _file, cb) => cb(null, `restore-${Date.now()}.db`),
  }),
  limits: { fileSize: 80 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.db' || ext === '.sqlite' || ext === '.sqlite3') cb(null, true);
    else cb(new Error('Only .db / .sqlite backup files are allowed'));
  },
});

app.post('/admin/restore', strictLimiter, restoreUpload.single('file'), async (req, res) => {
  try {
    const user = extractUser(req.headers.authorization || '');
    if (!user || user['role'] !== 'ADMIN') {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Admin only' });
    }
    if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });
    const dbPath = sqliteFilePath();
    if (!dbPath) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'SQLite path could not be resolved' });
    }
    await prisma.$disconnect();
    fs.copyFileSync(req.file.path, dbPath);
    fs.unlink(req.file.path, () => {});
    await prisma.$connect();
    res.json({ success: true, restoredTo: dbPath });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ error: 'Restore failed' });
  }
});

// ── Database readiness + optional seed ───────────────────────────────────────
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
      console.log('[db] No users found — running seed…');
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env: process.env });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[db] Seed check failed:', msg);
    try {
      execSync('npx prisma db push --accept-data-loss --skip-generate', {
        stdio: 'inherit',
        env: process.env,
      });
      execSync('npx tsx prisma/seed.ts', { stdio: 'inherit', env: process.env });
    } catch (seedErr: unknown) {
      const seedMsg = seedErr instanceof Error ? seedErr.message : String(seedErr);
      console.error('[db] Auto-seed failed:', seedMsg);
    }
  }
}

// ── Start server ──────────────────────────────────────────────────────────────
async function startServer() {
  await ensureDatabaseReady();

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    csrfPrevention: false,
    validationRules: [...specifiedRules, depthLimit(12)],
  });

  await server.start();

  // GET /graphql — informational response for browsers/curl
  app.get('/graphql', cors<cors.CorsRequest>(corsOptions), (_req, res) => {
    res.json({
      status: 'ok',
      message: 'GraphQL endpoint is running. Send queries with POST.',
      endpoint: '/graphql',
    });
  });

  app.use(
    '/graphql',
    cors<cors.CorsRequest>(corsOptions),
    express.json(),
    graphqlMutationGate,
    expressMiddleware(server, {
      context: async ({ req }) => {
        const user = extractUser(req.headers.authorization || '');
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

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`📈 Metrics:      http://localhost:${PORT}/metrics`);
    console.log(`✅ Database:     Connected`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
