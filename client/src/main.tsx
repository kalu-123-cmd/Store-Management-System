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

// ── HTTP link ────────────────────────────────────────────────────────────────

const httpLink = createHttpLink({
  uri: 'http://localhost:4000/graphql',
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

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    for (const err of graphQLErrors) {
      const msg = err.message.toLowerCase()
      if (
        msg.includes('not authenticated') ||
        msg.includes('invalid token') ||
        msg.includes('jwt expired') ||
        msg.includes('unauthorized')
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
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' },
  },
})

// ── Render ───────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </ApolloProvider>
  </React.StrictMode>,
)
