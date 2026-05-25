/** Azure app registration setup commands for OpenSyber CSPM onboarding */

interface SetupResponse {
  script: string;
  instructions: string[];
  requiredPermissions: string[];
}

export function getAzureSetup(): SetupResponse {
  const script = `# Create Azure App Registration for OpenSyber CSPM
az ad app create \\
  --display-name "OpenSyber CSPM" \\
  --sign-in-audience AzureADMyOrg

# Store the app ID
APP_ID=$(az ad app list --display-name "OpenSyber CSPM" --query "[0].appId" -o tsv)

# Create a client secret (valid 1 year)
az ad app credential reset \\
  --id $APP_ID \\
  --years 1 \\
  --query password -o tsv

# Create a service principal
az ad sp create --id $APP_ID

# Assign Security Reader role at subscription scope
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
az role assignment create \\
  --assignee $APP_ID \\
  --role "Security Reader" \\
  --scope "/subscriptions/$SUBSCRIPTION_ID"

# Add Microsoft Graph API permissions
az ad app permission add \\
  --id $APP_ID \\
  --api 00000003-0000-0000-c000-000000000000 \\
  --api-permissions \\
    e1fe6dd8-ba31-4d61-89e7-88639da4683d=Role \\
    7ab1d382-f21e-4acd-a863-ba3e13f7da61=Role

# Grant admin consent for the permissions
az ad app permission admin-consent --id $APP_ID

echo "App ID (Client ID): $APP_ID"
echo "Subscription ID: $SUBSCRIPTION_ID"
echo "Copy the Client ID and Secret for the next step."`;

  return {
    script,
    instructions: [
      'Open a terminal with Azure CLI installed and authenticated.',
      'Run the script above to create an app registration.',
      'Save the Client Secret output — it will only be shown once.',
      'Note the App ID (Client ID) and your Tenant ID.',
      'Enter the Client ID, Client Secret, and Tenant ID in the next step.',
    ],
    requiredPermissions: [
      'Security Reader (subscription-level RBAC role)',
      'Microsoft Graph: User.Read.All (application)',
      'Microsoft Graph: Directory.Read.All (application)',
    ],
  };
}
