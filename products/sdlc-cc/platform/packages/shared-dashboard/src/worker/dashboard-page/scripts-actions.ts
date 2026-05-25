/**
 * Dashboard Page - Action scripts (API keys, settings, account)
 */

export const dashboardScriptsActions = `
        function openCreateKeyModal() {
            document.getElementById('create-key-modal').classList.add('active');
        }

        function closeCreateKeyModal() {
            document.getElementById('create-key-modal').classList.remove('active');
            document.getElementById('key-name').value = '';
        }

        async function createAPIKey() {
            const name = document.getElementById('key-name').value;
            const environment = document.getElementById('key-environment').value;

            if (!name) {
                alert('Please enter a key name');
                return;
            }

            const token = localStorage.getItem('access_token');

            try {
                const response = await fetch('/api/v1/keys/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${token}\`
                    },
                    body: JSON.stringify({ name, environment })
                });

                if (response.ok) {
                    const data = await response.json();
                    alert(\`API Key created: \${data.key}\\n\\nMake sure to copy it now. You won't be able to see it again!\`);
                    closeCreateKeyModal();
                    loadStats();
                } else {
                    alert('Failed to create API key');
                }
            } catch (error) {
                console.error('Error creating API key:', error);
                alert('An error occurred while creating the API key');
            }
        }

        async function saveSettings() {
            const token = localStorage.getItem('access_token');
            const email = document.getElementById('settings-email').value;
            const company = document.getElementById('settings-company').value;
            const timezone = document.getElementById('settings-timezone').value;

            try {
                const response = await fetch('/api/v1/auth/update', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': \`Bearer \${token}\`
                    },
                    body: JSON.stringify({ email, company, timezone })
                });

                if (response.ok) {
                    alert('Settings saved successfully!');
                } else {
                    alert('Failed to save settings');
                }
            } catch (error) {
                console.error('Error saving settings:', error);
                alert('An error occurred while saving settings');
            }
        }

        function confirmDelete() {
            const confirmed = confirm('Are you absolutely sure you want to delete your account? This action cannot be undone.');
            if (confirmed) {
                const doubleConfirm = prompt('Type DELETE to confirm:');
                if (doubleConfirm === 'DELETE') {
                    deleteAccount();
                }
            }
        }

        async function deleteAccount() {
            const token = localStorage.getItem('access_token');

            try {
                const response = await fetch('/api/v1/auth/delete', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': \`Bearer \${token}\`
                    }
                });

                if (response.ok) {
                    alert('Account deleted successfully');
                    logout();
                } else {
                    alert('Failed to delete account');
                }
            } catch (error) {
                console.error('Error deleting account:', error);
                alert('An error occurred while deleting account');
            }
        }

        function logout() {
            localStorage.removeItem('access_token');
            localStorage.removeItem('pending_token');
            window.location.href = '/auth/login';
        }
    </script>
</body>
</html>`;
