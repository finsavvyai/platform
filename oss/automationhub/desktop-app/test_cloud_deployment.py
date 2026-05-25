#!/usr/bin/env python3
"""
Test the complete cloud deployment workflow for UPM.Plus
Tests project creation, GitHub repo creation, and cloud deployment
"""

import requests
import time
import json
from datetime import datetime

BASE_URL = "http://localhost:8015/api/v1"

def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def test_health_check():
    """Test if the backend is running"""
    print_section("Health Check")
    response = requests.get(f"{BASE_URL}/health")
    assert response.status_code == 200
    data = response.json()
    print(f"✅ Backend is healthy: {data}")
    return data

def test_get_templates():
    """Get available project templates"""
    print_section("Available Templates")
    response = requests.get(f"{BASE_URL}/templates")
    assert response.status_code == 200
    data = response.json()
    print(f"Found {len(data['data'])} templates:")
    for template in data['data']:
        print(f"  - {template['name']} ({template['type']}): {template['description']}")
    return data['data']

def test_create_project(template_id):
    """Create a new project"""
    print_section("Creating Project")
    project_data = {
        "name": f"cloud-test-{int(time.time())}",
        "description": "Test project for cloud deployment",
        "template": template_id
    }

    print(f"Creating project: {project_data['name']}")
    response = requests.post(f"{BASE_URL}/projects/scaffold", json=project_data)
    assert response.status_code == 200
    data = response.json()
    print(f"✅ Project created: {data['data']}")
    return data['data']

def test_build_project(project_id):
    """Build the project"""
    print_section("Building Project")
    print(f"Starting build for project ID: {project_id}")
    response = requests.post(f"{BASE_URL}/projects/{project_id}/build", json={})
    assert response.status_code == 200
    data = response.json()
    print(f"✅ Build started: {data['data']}")

    # Poll build status
    build_id = data['data']['id']
    print(f"Monitoring build {build_id}...")

    for i in range(10):  # Poll for up to 20 seconds
        time.sleep(2)
        response = requests.get(f"{BASE_URL}/builds/{build_id}")
        if response.status_code == 200:
            build_data = response.json()['data']
            status = build_data['status']
            print(f"  Build status: {status}")
            if status != 'building':
                if status == 'success':
                    print(f"✅ Build completed successfully!")
                else:
                    print(f"❌ Build failed!")
                return build_data

    print("⚠️ Build timeout - may still be running")
    return build_data

def test_create_github_repo(project_id):
    """Create GitHub repository for the project"""
    print_section("Creating GitHub Repository")
    print(f"Creating GitHub repo for project ID: {project_id}")
    response = requests.post(f"{BASE_URL}/projects/{project_id}/github", json={})
    assert response.status_code == 200
    data = response.json()
    print(f"✅ GitHub repository created:")
    print(f"  URL: {data['data']['repo_url']}")
    print(f"  Clone URL: {data['data']['clone_url']}")
    return data['data']

def test_get_cloud_providers():
    """Get available cloud providers"""
    print_section("Cloud Providers")
    response = requests.get(f"{BASE_URL}/cloud/providers")
    assert response.status_code == 200
    data = response.json()
    print(f"Available cloud providers:")
    for provider_id, info in data['data'].items():
        print(f"  - {info['name']} (supports: {', '.join(info['supports'])})")
    return data['data']

def test_deploy_to_cloud(project_id, provider):
    """Deploy project to cloud provider"""
    print_section(f"Deploying to {provider}")
    deployment_data = {
        "provider": provider,
        "environment": "production"
    }

    print(f"Deploying project {project_id} to {provider}...")
    response = requests.post(f"{BASE_URL}/projects/{project_id}/deploy/cloud", json=deployment_data)
    assert response.status_code == 200
    data = response.json()
    print(f"✅ Deployment successful!")
    print(f"  Live URL: {data['data']['url']}")
    print(f"  Dashboard: {data['data']['dashboard_url']}")
    print(f"  Status: {data['data']['status']}")
    return data['data']

def test_get_deployments(project_id):
    """Get all deployments for a project"""
    print_section("Project Deployments")
    response = requests.get(f"{BASE_URL}/projects/{project_id}/deployments")
    assert response.status_code == 200
    data = response.json()
    print(f"Found {len(data['data'])} deployments:")
    for deployment in data['data']:
        print(f"  - {deployment['provider']} ({deployment['environment']}): {deployment['url']}")
    return data['data']

def test_complete_workflow():
    """Test the complete cloud deployment workflow"""
    print("\n" + "="*60)
    print("  🚀 UPM.Plus Cloud Deployment Test Suite")
    print("="*60)

    try:
        # 1. Health check
        test_health_check()

        # 2. Get templates
        templates = test_get_templates()
        react_template = next((t for t in templates if t['type'] == 'react'), templates[0])

        # 3. Create project
        project = test_create_project(react_template['id'])
        project_id = project['id']

        # 4. Build project
        build = test_build_project(project_id)

        # 5. Create GitHub repo
        github_repo = test_create_github_repo(project_id)

        # 6. Get cloud providers
        providers = test_get_cloud_providers()

        # 7. Deploy to multiple clouds
        # Deploy to Vercel (good for React)
        if 'vercel' in providers:
            vercel_deployment = test_deploy_to_cloud(project_id, 'vercel')

        # Deploy to Netlify too
        if 'netlify' in providers:
            netlify_deployment = test_deploy_to_cloud(project_id, 'netlify')

        # 8. Get all deployments
        deployments = test_get_deployments(project_id)

        print_section("✅ All Tests Passed!")
        print("Summary:")
        print(f"  - Project: {project['name']}")
        print(f"  - Template: {react_template['name']}")
        print(f"  - GitHub: {github_repo['repo_url']}")
        print(f"  - Deployments: {len(deployments)} cloud providers")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True

if __name__ == "__main__":
    success = test_complete_workflow()
    exit(0 if success else 1)