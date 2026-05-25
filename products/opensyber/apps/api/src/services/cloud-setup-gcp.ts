/** GCP service account setup commands for OpenSyber CSPM onboarding */

interface SetupResponse {
  script: string;
  instructions: string[];
  requiredPermissions: string[];
}

export function getGcpSetup(): SetupResponse {
  const script = `# Set your project ID
PROJECT_ID=$(gcloud config get-value project)

# Create a service account for OpenSyber
gcloud iam service-accounts create opensyber-cspm \\
  --display-name="OpenSyber CSPM Scanner" \\
  --description="Service account for OpenSyber cloud security scanning" \\
  --project=$PROJECT_ID

# Get the service account email
SA_EMAIL="opensyber-cspm@$PROJECT_ID.iam.gserviceaccount.com"

# Grant Security Center findings viewer
gcloud projects add-iam-policy-binding $PROJECT_ID \\
  --member="serviceAccount:$SA_EMAIL" \\
  --role="roles/securitycenter.findingsViewer"

# Grant Security Center sources viewer
gcloud projects add-iam-policy-binding $PROJECT_ID \\
  --member="serviceAccount:$SA_EMAIL" \\
  --role="roles/securitycenter.sourcesViewer"

# Grant IAM security reviewer (read-only IAM audit)
gcloud projects add-iam-policy-binding $PROJECT_ID \\
  --member="serviceAccount:$SA_EMAIL" \\
  --role="roles/iam.securityReviewer"

# Create and download the key file
gcloud iam service-accounts keys create opensyber-cspm-key.json \\
  --iam-account=$SA_EMAIL \\
  --project=$PROJECT_ID

echo "Service account key saved to opensyber-cspm-key.json"
echo "Upload this JSON file in the next step of the wizard."`;

  return {
    script,
    instructions: [
      'Open Cloud Shell or a terminal with gcloud CLI authenticated.',
      'Make sure the correct project is selected (gcloud config set project YOUR_PROJECT).',
      'Run the script above to create a service account and download the key.',
      'A JSON key file will be saved as opensyber-cspm-key.json.',
      'Upload or paste the JSON key contents in the next step.',
    ],
    requiredPermissions: [
      'Security Center Findings Viewer (roles/securitycenter.findingsViewer)',
      'Security Center Sources Viewer (roles/securitycenter.sourcesViewer)',
      'IAM Security Reviewer (roles/iam.securityReviewer)',
    ],
  };
}
