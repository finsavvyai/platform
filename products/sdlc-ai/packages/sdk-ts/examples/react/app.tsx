// React application example

import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SDLCProvider, useAuth, useDocuments, useRAG } from '@sdlc/sdln-js/react';
import { DocumentUpload } from '@sdlc/sdln-js/react';

function App() {
  return (
    <SDLCProvider
      config={{
        baseURL: 'https://api.sdlc.ai',
        apiKey: process.env.REACT_APP_SDLC_API_KEY
      }}
    >
      <Dashboard />
    </SDLCProvider>
  );
}

function Dashboard() {
  const { user, isAuthenticated, login, logout, isLoading } = useAuth();
  const { documents, uploadDocument } = useDocuments();
  const { query, isLoading: isQuerying } = useRAG();
  const [queryText, setQueryText] = useState('');
  const [answer, setAnswer] = useState('');

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="login">
        <h2>Login to SDLC.ai</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const email = e.currentTarget.email.value;
          const password = e.currentTarget.password.value;
          try {
            await login({ email, password });
          } catch (error) {
            alert(error.message);
          }
        }}>
          <input type="email" name="email" placeholder="Email" required />
          <input type="password" name="password" placeholder="Password" required />
          <button type="submit">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header>
        <h1>Welcome, {user?.firstName}!</h1>
        <button onClick={logout}>Logout</button>
      </header>

      <main>
        <section>
          <h2>Upload Document</h2>
          <DocumentUpload
            onUploadComplete={(doc) => {
              console.log('Document uploaded:', doc);
            }}
            onUploadError={(error) => {
              alert(`Upload failed: ${error.message}`);
            }}
          />
        </section>

        <section>
          <h2>Documents ({documents.total})</h2>
          <ul>
            {documents.items.slice(0, 5).map(doc => (
              <li key={doc.id}>
                {doc.name} ({doc.type})
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Ask a Question</h2>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!queryText.trim()) return;

            try {
              const response = await query({ query: queryText });
              setAnswer(response.answer);
            } catch (error) {
              setAnswer(`Error: ${error.message}`);
            }
          }}>
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Ask about your documents..."
              disabled={isQuerying}
            />
            <button type="submit" disabled={isQuerying}>
              {isQuerying ? 'Asking...' : 'Ask'}
            </button>
          </form>

          {answer && (
            <div className="answer">
              <h3>Answer:</h3>
              <p>{answer}</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// Render the app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
