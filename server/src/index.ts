import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_12345';

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

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── GraphQL ───────────────────────────────────────────────────────────────────
interface MyContext {
  prisma: PrismaClient;
  user: any;
}

const server = new ApolloServer<MyContext>({
  typeDefs,
  resolvers,
});

const startServer = async () => {
  await server.start();

  app.use(
    '/graphql',
    // Re-use the same cors options — do NOT pass a new bare cors() here
    cors(corsOptions),
    express.json({ limit: '10mb' }),
    expressMiddleware(server, {
      context: async ({ req }) => {
        let user = null;
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
          const token = authHeader.split(' ')[1];
          try {
            user = jwt.verify(token, JWT_SECRET);
          } catch {
            // Invalid or expired token — user stays null
          }
        }
        return { prisma, user };
      },
    })
  );

  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}/graphql`);
  });
};

startServer().catch((error) => console.error(error));
