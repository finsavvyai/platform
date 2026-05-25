use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tauri::command;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: String,
    pub path: String,
    pub project_type: String,
    pub tech_stack: TechStack,
    pub status: ProjectStatus,
    pub created_at: String,
    pub last_modified: String,
    pub git_url: Option<String>,
    pub deployment_url: Option<String>,
    pub health_score: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TechStack {
    pub frontend: String,
    pub backend: String,
    pub database: String,
    pub hosting: String,
    pub additional: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum ProjectStatus {
    Active,
    Inactive,
    Deploying,
    Error,
    Draft,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectCreationRequest {
    pub name: String,
    pub description: String,
    pub tech_stack: TechStack,
    pub features: Vec<String>,
    pub target_directory: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIAnalysisResult {
    pub project_type: String,
    pub suggested_tech_stack: TechStack,
    pub estimated_complexity: String,
    pub features: Vec<String>,
    pub deployment_recommendations: Vec<String>,
    pub cost_estimate: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalProjectScan {
    pub path: String,
    pub name: String,
    pub project_type: String,
    pub tech_stack: TechStack,
    pub git_repo: bool,
    pub package_manager: Option<String>,
    pub last_modified: String,
}

/// Get all projects from local storage and scanned directories
#[command]
pub async fn get_projects() -> Result<Vec<Project>, String> {
    log::info!("Getting all projects");

    let mut projects = Vec::new();

    // Load saved projects from local storage
    // This would integrate with Tauri's store plugin
    let saved_projects = load_saved_projects().await?;
    projects.extend(saved_projects);

    // Scan for local projects
    let scanned_projects = scan_local_projects_internal().await?;
    for scanned in scanned_projects {
        // Convert scanned projects to Project format
        let project = Project {
            id: generate_project_id(&scanned.path),
            name: scanned.name,
            description: format!("Auto-detected {} project", scanned.project_type),
            path: scanned.path,
            project_type: scanned.project_type,
            tech_stack: scanned.tech_stack,
            status: ProjectStatus::Inactive,
            created_at: scanned.last_modified.clone(),
            last_modified: scanned.last_modified,
            git_url: None,
            deployment_url: None,
            health_score: 85.0,
        };
        projects.push(project);
    }

    Ok(projects)
}

/// Create a new project with AI assistance
#[command]
pub async fn create_project(request: ProjectCreationRequest) -> Result<Project, String> {
    log::info!("Creating new project: {}", request.name);

    let project_id = Uuid::new_v4().to_string();
    let target_dir = request.target_directory
        .unwrap_or_else(|| format!("{}/Projects/{}", dirs::home_dir().unwrap().display(), request.name));

    // Create project directory
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create project directory: {}", e))?;

    // Generate project structure based on tech stack
    generate_project_structure(&target_dir, &request).await?;

    // Initialize git repository
    initialize_git_repo(&target_dir).await?;

    // Create project configuration
    let project = Project {
        id: project_id,
        name: request.name,
        description: request.description,
        path: target_dir,
        project_type: infer_project_type(&request.tech_stack),
        tech_stack: request.tech_stack,
        status: ProjectStatus::Active,
        created_at: chrono::Utc::now().to_rfc3339(),
        last_modified: chrono::Utc::now().to_rfc3339(),
        git_url: None,
        deployment_url: None,
        health_score: 100.0,
    };

    // Save project to local storage
    save_project(&project).await?;

    Ok(project)
}

/// Scan local directories for existing projects
#[command]
pub async fn scan_local_projects() -> Result<Vec<LocalProjectScan>, String> {
    scan_local_projects_internal().await
}

/// Analyze project description with AI
#[command]
pub async fn analyze_project_description(description: String) -> Result<AIAnalysisResult, String> {
    log::info!("Analyzing project description with AI");

    // This would integrate with your backend AI service
    // For now, we'll simulate intelligent analysis

    let analysis = if description.to_lowercase().contains("social media") {
        AIAnalysisResult {
            project_type: "Social Media Platform".to_string(),
            suggested_tech_stack: TechStack {
                frontend: "React".to_string(),
                backend: "Node.js".to_string(),
                database: "PostgreSQL".to_string(),
                hosting: "AWS".to_string(),
                additional: vec!["Redis".to_string(), "Socket.io".to_string()],
            },
            estimated_complexity: "High".to_string(),
            features: vec![
                "User Authentication".to_string(),
                "Photo/Video Upload".to_string(),
                "Real-time Messaging".to_string(),
                "Feed Algorithm".to_string(),
                "Push Notifications".to_string(),
            ],
            deployment_recommendations: vec![
                "Use CDN for media files".to_string(),
                "Implement Redis for caching".to_string(),
                "Set up auto-scaling".to_string(),
            ],
            cost_estimate: "$50-200/month".to_string(),
        }
    } else if description.to_lowercase().contains("ecommerce") || description.to_lowercase().contains("store") {
        AIAnalysisResult {
            project_type: "E-commerce Platform".to_string(),
            suggested_tech_stack: TechStack {
                frontend: "Next.js".to_string(),
                backend: "Node.js".to_string(),
                database: "PostgreSQL".to_string(),
                hosting: "Vercel".to_string(),
                additional: vec!["Stripe".to_string(), "Prisma".to_string()],
            },
            estimated_complexity: "Medium".to_string(),
            features: vec![
                "Product Catalog".to_string(),
                "Shopping Cart".to_string(),
                "Payment Processing".to_string(),
                "Order Management".to_string(),
                "Admin Dashboard".to_string(),
            ],
            deployment_recommendations: vec![
                "Integrate Stripe for payments".to_string(),
                "Set up inventory management".to_string(),
                "Configure SSL certificates".to_string(),
            ],
            cost_estimate: "$30-100/month".to_string(),
        }
    } else {
        // Generic web application
        AIAnalysisResult {
            project_type: "Web Application".to_string(),
            suggested_tech_stack: TechStack {
                frontend: "React".to_string(),
                backend: "Node.js".to_string(),
                database: "PostgreSQL".to_string(),
                hosting: "Vercel".to_string(),
                additional: vec![],
            },
            estimated_complexity: "Medium".to_string(),
            features: vec![
                "User Authentication".to_string(),
                "Database Integration".to_string(),
                "API Endpoints".to_string(),
                "Responsive Design".to_string(),
            ],
            deployment_recommendations: vec![
                "Set up CI/CD pipeline".to_string(),
                "Configure environment variables".to_string(),
                "Enable monitoring".to_string(),
            ],
            cost_estimate: "$10-50/month".to_string(),
        }
    };

    Ok(analysis)
}

/// Get AI suggestions based on project description
#[command]
pub async fn get_ai_suggestions(description: String) -> Result<Vec<HashMap<String, serde_json::Value>>, String> {
    log::info!("Getting AI suggestions for: {}", description);

    // Simulate AI-powered suggestions
    let suggestions = vec![
        HashMap::from([
            ("id".to_string(), serde_json::Value::String("1".to_string())),
            ("title".to_string(), serde_json::Value::String("Add Real-time Features".to_string())),
            ("description".to_string(), serde_json::Value::String("Consider adding WebSocket support for real-time updates".to_string())),
            ("impact".to_string(), serde_json::Value::String("High".to_string())),
        ]),
        HashMap::from([
            ("id".to_string(), serde_json::Value::String("2".to_string())),
            ("title".to_string(), serde_json::Value::String("Mobile-First Design".to_string())),
            ("description".to_string(), serde_json::Value::String("Implement responsive design for mobile users".to_string())),
            ("impact".to_string(), serde_json::Value::String("Medium".to_string())),
        ]),
    ];

    Ok(suggestions)
}

// Helper functions

async fn load_saved_projects() -> Result<Vec<Project>, String> {
    // This would load from Tauri's store
    // For now, return empty vector
    Ok(Vec::new())
}

async fn scan_local_projects_internal() -> Result<Vec<LocalProjectScan>, String> {
    let mut projects = Vec::new();

    // Common project directories
    let scan_dirs = vec![
        format!("{}/Projects", dirs::home_dir().unwrap().display()),
        format!("{}/Development", dirs::home_dir().unwrap().display()),
        format!("{}/Code", dirs::home_dir().unwrap().display()),
        format!("{}/Sites", dirs::home_dir().unwrap().display()),
    ];

    for dir in scan_dirs {
        if Path::new(&dir).exists() {
            if let Ok(entries) = fs::read_dir(&dir) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        if let Ok(project) = analyze_directory(&entry.path()).await {
                            projects.push(project);
                        }
                    }
                }
            }
        }
    }

    Ok(projects)
}

async fn analyze_directory(path: &Path) -> Result<LocalProjectScan, String> {
    let path_str = path.to_string_lossy().to_string();
    let name = path.file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Detect project type and tech stack
    let (project_type, tech_stack, package_manager) = detect_project_info(path).await?;

    // Check if it's a git repository
    let git_repo = path.join(".git").exists();

    // Get last modified time
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to get directory metadata: {}", e))?;
    let last_modified = chrono::DateTime::<chrono::Utc>::from(metadata.modified().unwrap())
        .to_rfc3339();

    Ok(LocalProjectScan {
        path: path_str,
        name,
        project_type,
        tech_stack,
        git_repo,
        package_manager,
        last_modified,
    })
}

async fn detect_project_info(path: &Path) -> Result<(String, TechStack, Option<String>), String> {
    let mut project_type = "Unknown".to_string();
    let mut frontend = "HTML".to_string();
    let mut backend = "None".to_string();
    let mut database = "None".to_string();
    let mut hosting = "None".to_string();
    let mut package_manager = None;

    // Check for package.json (Node.js project)
    if path.join("package.json").exists() {
        package_manager = Some("npm".to_string());
        backend = "Node.js".to_string();
        project_type = "Web Application".to_string();

        // Try to read package.json to detect framework
        if let Ok(content) = fs::read_to_string(path.join("package.json")) {
            if content.contains("\"react\"") {
                frontend = "React".to_string();
            } else if content.contains("\"vue\"") {
                frontend = "Vue.js".to_string();
            } else if content.contains("\"angular\"") {
                frontend = "Angular".to_string();
            } else if content.contains("\"next\"") {
                frontend = "Next.js".to_string();
            }
        }
    }

    // Check for requirements.txt (Python project)
    if path.join("requirements.txt").exists() || path.join("pyproject.toml").exists() {
        backend = "Python".to_string();
        project_type = "Python Application".to_string();
        package_manager = Some("pip".to_string());
    }

    // Check for Cargo.toml (Rust project)
    if path.join("Cargo.toml").exists() {
        backend = "Rust".to_string();
        project_type = "Rust Application".to_string();
        package_manager = Some("cargo".to_string());
    }

    // Check for go.mod (Go project)
    if path.join("go.mod").exists() {
        backend = "Go".to_string();
        project_type = "Go Application".to_string();
        package_manager = Some("go".to_string());
    }

    let tech_stack = TechStack {
        frontend,
        backend,
        database,
        hosting,
        additional: Vec::new(),
    };

    Ok((project_type, tech_stack, package_manager))
}

async fn generate_project_structure(target_dir: &str, request: &ProjectCreationRequest) -> Result<(), String> {
    // Generate project files based on tech stack
    match request.tech_stack.frontend.as_str() {
        "React" => generate_react_project(target_dir, request).await?,
        "Vue.js" => generate_vue_project(target_dir, request).await?,
        "Next.js" => generate_nextjs_project(target_dir, request).await?,
        _ => generate_basic_web_project(target_dir, request).await?,
    }

    Ok(())
}

async fn generate_react_project(target_dir: &str, request: &ProjectCreationRequest) -> Result<(), String> {
    // Create package.json
    let package_json = serde_json::json!({
        "name": request.name,
        "version": "0.1.0",
        "private": true,
        "dependencies": {
            "react": "^18.2.0",
            "react-dom": "^18.2.0",
            "react-scripts": "5.0.1"
        },
        "scripts": {
            "start": "react-scripts start",
            "build": "react-scripts build",
            "test": "react-scripts test",
            "eject": "react-scripts eject"
        },
        "browserslist": {
            "production": [">0.2%", "not dead", "not op_mini all"],
            "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
        }
    });

    fs::write(
        format!("{}/package.json", target_dir),
        serde_json::to_string_pretty(&package_json).unwrap()
    ).map_err(|e| format!("Failed to write package.json: {}", e))?;

    // Create basic React app structure
    fs::create_dir_all(format!("{}/src", target_dir))
        .map_err(|e| format!("Failed to create src directory: {}", e))?;
    fs::create_dir_all(format!("{}/public", target_dir))
        .map_err(|e| format!("Failed to create public directory: {}", e))?;

    // Create index.html
    let index_html = r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>React App</title>
</head>
<body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
</body>
</html>"#;

    fs::write(format!("{}/public/index.html", target_dir), index_html)
        .map_err(|e| format!("Failed to write index.html: {}", e))?;

    // Create App.js
    let app_js = r#"import React from 'react';

function App() {
  return (
    <div className="App">
      <header>
        <h1>Welcome to your new React app!</h1>
        <p>Built with UPM.Plus</p>
      </header>
    </div>
  );
}

export default App;"#;

    fs::write(format!("{}/src/App.js", target_dir), app_js)
        .map_err(|e| format!("Failed to write App.js: {}", e))?;

    // Create index.js
    let index_js = r#"import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);"#;

    fs::write(format!("{}/src/index.js", target_dir), index_js)
        .map_err(|e| format!("Failed to write index.js: {}", e))?;

    Ok(())
}

async fn generate_vue_project(_target_dir: &str, _request: &ProjectCreationRequest) -> Result<(), String> {
    // TODO: Implement Vue.js project generation
    Ok(())
}

async fn generate_nextjs_project(_target_dir: &str, _request: &ProjectCreationRequest) -> Result<(), String> {
    // TODO: Implement Next.js project generation
    Ok(())
}

async fn generate_basic_web_project(_target_dir: &str, _request: &ProjectCreationRequest) -> Result<(), String> {
    // TODO: Implement basic web project generation
    Ok(())
}

async fn initialize_git_repo(target_dir: &str) -> Result<(), String> {
    use std::process::Command;

    let output = Command::new("git")
        .arg("init")
        .current_dir(target_dir)
        .output()
        .map_err(|e| format!("Failed to initialize git repository: {}", e))?;

    if !output.status.success() {
        return Err(format!("Git init failed: {}", String::from_utf8_lossy(&output.stderr)));
    }

    // Create .gitignore
    let gitignore = r#"# Dependencies
node_modules/
*/node_modules/

# Production builds
dist/
build/
out/

# Environment variables
.env
.env.local
.env.production

# Logs
*.log
logs/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Package managers
package-lock.json
yarn.lock
pnpm-lock.yaml"#;

    fs::write(format!("{}/.gitignore", target_dir), gitignore)
        .map_err(|e| format!("Failed to write .gitignore: {}", e))?;

    Ok(())
}

async fn save_project(project: &Project) -> Result<(), String> {
    // This would save to Tauri's store plugin
    // For now, just log
    log::info!("Saving project: {}", project.name);
    Ok(())
}

fn generate_project_id(path: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("proj_{:x}", hasher.finish())
}

fn infer_project_type(tech_stack: &TechStack) -> String {
    if tech_stack.frontend != "HTML" && tech_stack.backend != "None" {
        "Full-Stack Application".to_string()
    } else if tech_stack.frontend != "HTML" {
        "Frontend Application".to_string()
    } else if tech_stack.backend != "None" {
        "Backend Application".to_string()
    } else {
        "Web Application".to_string()
    }
}