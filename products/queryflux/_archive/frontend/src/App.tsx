function App() {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#333", marginBottom: "20px" }}>
        QueryFlux - AI-Powered Database Manager
      </h1>

      <div style={{ marginBottom: "40px" }}>
        <h2 style={{ color: "#666", marginBottom: "10px" }}>
          Transform Your Database Management
        </h2>
        <p style={{ color: "#888", lineHeight: "1.6" }}>
          The most advanced AI-powered database management platform. Connect to
          35+ databases, generate SQL from natural language, and collaborate
          with your team in real-time.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        <div
          style={{
            padding: "20px",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ color: "#8B5CF6", marginBottom: "10px" }}>
            🗄️ Multi-Database Support
          </h3>
          <p style={{ color: "#666" }}>
            Connect to PostgreSQL, MySQL, MongoDB, Redis, SQLite, and 30+ more
            databases.
          </p>
        </div>

        <div
          style={{
            padding: "20px",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ color: "#10B981", marginBottom: "10px" }}>
            🤖 AI-Powered Queries
          </h3>
          <p style={{ color: "#666" }}>
            Convert natural language to optimized SQL and get intelligent query
            suggestions.
          </p>
        </div>

        <div
          style={{
            padding: "20px",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ color: "#F59E0B", marginBottom: "10px" }}>
            👥 Real-time Collaboration
          </h3>
          <p style={{ color: "#666" }}>
            Share queries, collaborate with your team, and sync changes across
            devices.
          </p>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <h2 style={{ color: "#333", marginBottom: "20px" }}>
          Simple, Transparent Pricing
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
            maxWidth: "800px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              padding: "30px",
              border: "2px solid #e0e0e0",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <h3 style={{ color: "#333", marginBottom: "10px" }}>Starter</h3>
            <div
              style={{
                fontSize: "2em",
                fontWeight: "bold",
                color: "#8B5CF6",
                marginBottom: "20px",
              }}
            >
              $0
              <span style={{ fontSize: "0.5em", fontWeight: "normal" }}>
                /forever
              </span>
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ 3 databases
              </li>
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ Basic features
              </li>
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ Community support
              </li>
            </ul>
            <button
              style={{
                padding: "12px 24px",
                border: "2px solid #8B5CF6",
                borderRadius: "8px",
                background: "white",
                color: "#8B5CF6",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Get Started
            </button>
          </div>

          <div
            style={{
              padding: "30px",
              border: "2px solid #8B5CF6",
              borderRadius: "12px",
              textAlign: "center",
              background: "#f8f9ff",
            }}
          >
            <div
              style={{
                background: "#8B5CF6",
                color: "white",
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "0.8em",
                display: "inline-block",
                marginBottom: "10px",
              }}
            >
              Most Popular
            </div>
            <h3 style={{ color: "#333", marginBottom: "10px" }}>
              Professional
            </h3>
            <div
              style={{
                fontSize: "2em",
                fontWeight: "bold",
                color: "#8B5CF6",
                marginBottom: "20px",
              }}
            >
              $19
              <span style={{ fontSize: "0.5em", fontWeight: "normal" }}>
                /month
              </span>
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ 20 databases
              </li>
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ AI features
              </li>
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ Team collaboration
              </li>
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ Priority support
              </li>
            </ul>
            <button
              style={{
                padding: "12px 24px",
                border: "none",
                borderRadius: "8px",
                background: "#8B5CF6",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Start Free Trial
            </button>
          </div>

          <div
            style={{
              padding: "30px",
              border: "2px solid #e0e0e0",
              borderRadius: "12px",
              textAlign: "center",
            }}
          >
            <h3 style={{ color: "#333", marginBottom: "10px" }}>Enterprise</h3>
            <div
              style={{
                fontSize: "2em",
                fontWeight: "bold",
                color: "#8B5CF6",
                marginBottom: "20px",
              }}
            >
              Custom
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                marginBottom: "20px",
                textAlign: "left",
              }}
            >
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ Unlimited databases
              </li>
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ Advanced security
              </li>
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ Dedicated support
              </li>
              <li style={{ marginBottom: "8px", color: "#666" }}>
                ✓ Custom features
              </li>
            </ul>
            <button
              style={{
                padding: "12px 24px",
                border: "2px solid #8B5CF6",
                borderRadius: "8px",
                background: "white",
                color: "#8B5CF6",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Contact Sales
            </button>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <button
          style={{
            padding: "16px 32px",
            background: "#8B5CF6",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontSize: "1.1em",
            fontWeight: "bold",
            marginRight: "10px",
            cursor: "pointer",
          }}
        >
          📥 Download for Mac
        </button>
        <button
          style={{
            padding: "16px 32px",
            background: "#6B7280",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontSize: "1.1em",
            fontWeight: "bold",
            marginRight: "10px",
            cursor: "pointer",
          }}
        >
          📥 Download for Windows
        </button>
        <button
          style={{
            padding: "16px 32px",
            background: "#10B981",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontSize: "1.1em",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          🔧 VS Code Extension
        </button>
      </div>

      <footer
        style={{
          textAlign: "center",
          padding: "40px 20px",
          borderTop: "1px solid #e0e0e0",
          color: "#666",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #8B5CF6, #EC4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "10px",
            }}
          >
            <span
              style={{ color: "white", fontWeight: "bold", fontSize: "1.2em" }}
            >
              Q
            </span>
          </div>
          <span style={{ fontSize: "1.2em", fontWeight: "bold" }}>
            QueryFlux
          </span>
        </div>
        <p>© 2025 QueryFlux. The future of database management.</p>
        <div style={{ marginTop: "10px" }}>
          <button
            style={{
              padding: "8px",
              margin: "0 5px",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              background: "white",
              cursor: "pointer",
            }}
          >
            📧
          </button>
          <button
            style={{
              padding: "8px",
              margin: "0 5px",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              background: "white",
              cursor: "pointer",
            }}
          >
            🐦
          </button>
          <button
            style={{
              padding: "8px",
              margin: "0 5px",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              background: "white",
              cursor: "pointer",
            }}
          >
            💼
          </button>
        </div>
      </footer>
    </div>
  );
}

export default App;
