import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import {
  ApolloClient, InMemoryCache, ApolloProvider,
  createHttpLink, from,
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/Toast.tsx'
import { LangProvider } from './lib/LangContext.tsx'
import PWAInstallPrompt from './components/PWAInstallPrompt.tsx'
import './i18n/config' // Initialize i18next

// ── Service worker cleanup in dev ─────────────────────────────────────────────
// Unregister any stale SW from previous sessions. The workbox-generated SW
// in dev can throw "Cannot read properties of undefined (reading 'startTime')"
// from its PerformanceObserver — this cleanup prevents stale SWs from running.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => void registration.unregister())
  })
  void caches.keys().then((keys) => {
    keys.forEach((key) => void caches.delete(key))
  })
}

// ── JWT expiry check on startup ───────────────────────────────────────────────
// Parse the JWT without verifying signature (browser cannot verify — server does).
// This only prevents sending an obviously expired token unnecessarily.
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!));
    if (typeof payload?.exp !== 'number') return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return false; // malformed token — let the server reject it
  }
}

const storedToken = localStorage.getItem('token');
if (storedToken && isTokenExpired(storedToken)) {
  // Token has expired — clear auth state so user is redirected to login
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// ── HTTP link ────────────────────────────────────────────────────────────────

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL || 'http://localhost:4000/graphql',
})

// ── Auth link — inject Bearer token ─────────────────────────────────────────

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token')
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  }
})

// ── Error link — auto-logout on auth errors ──────────────────────────────────
// Only force-logout on auth errors from mutations or explicit user-initiated queries.
// Background polling queries (StockAlertBell, etc.) should NOT trigger logout —
// they may fire briefly before the token is available after login navigation.

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const msg = err.message.toLowerCase()
      // Only hard-logout on auth errors from non-background operations
      // Background polls are identified by their operation context or name
      const opName = operation.operationName?.toLowerCase() ?? ''
      const isBackgroundPoll = opName.includes('alert') || opName.includes('stock') || opName.includes('notification')
      if (
        !isBackgroundPoll &&
        (
          msg.includes('invalid token') ||
          msg.includes('jwt expired') ||
          msg.includes('jwt malformed')
        )
      ) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        // Hard redirect so Apollo cache is fully cleared
        window.location.href = '/login'
        return
      }
    }
  }
  if (networkError) {
    console.warn('[Network error]', networkError)
  }
})

// ── Apollo client ────────────────────────────────────────────────────────────

const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      DashboardStats: { keyFields: ['id'] },
      CategoryRevenue: { keyFields: false },
    },
  }),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-first', errorPolicy: 'ignore' },
  },
})

// ── Render ───────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter>
        <LangProvider>
          <ToastProvider>
            <App />
            <PWAInstallPrompt />
          </ToastProvider>
        </LangProvider>
      </BrowserRouter>
    </ApolloProvider>
  </React.StrictMode>,
)
