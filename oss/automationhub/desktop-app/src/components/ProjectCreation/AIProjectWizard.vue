<template>
  <div class="max-w-4xl mx-auto p-6">
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
        <span class="text-2xl">🤖</span>
      </div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        AI Project Wizard
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        Describe your project and let AI build it for you
      </p>
    </div>

    <!-- Wizard Steps -->
    <div class="mb-8">
      <div class="flex justify-center">
        <div class="flex items-center space-x-4">
          <WizardStep
            v-for="(step, index) in wizardSteps"
            :key="step.id"
            :step="step"
            :current="currentStep === index"
            :completed="currentStep > index"
            :last="index === wizardSteps.length - 1"
          />
        </div>
      </div>
    </div>

    <!-- Step Content -->
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <!-- Step 1: Project Description -->
      <div v-if="currentStep === 0" class="p-8">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          What would you like to build?
        </h2>

        <div class="space-y-6">
          <!-- AI Input -->
          <div class="relative">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Describe your project
            </label>
            <textarea
              v-model="projectDescription"
              placeholder="Example: Build me a social media app like Instagram with user authentication, photo sharing, real-time messaging, and a feed algorithm"
              class="w-full h-32 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              @input="generateSuggestions"
            />
            <div class="absolute bottom-3 right-3 flex items-center space-x-2">
              <div v-if="isAnalyzing" class="flex items-center space-x-2 text-sm text-gray-500">
                <div class="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                <span>AI analyzing...</span>
              </div>
              <button
                @click="analyzeProject"
                :disabled="!projectDescription.trim() || isAnalyzing"
                class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🔍 Analyze
              </button>
            </div>
          </div>

          <!-- Quick Templates -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Or choose a template
            </label>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <TemplateCard
                v-for="template in projectTemplates"
                :key="template.id"
                :template="template"
                :selected="selectedTemplate?.id === template.id"
                @select="selectTemplate"
              />
            </div>
          </div>

          <!-- AI Suggestions -->
          <div v-if="aiSuggestions.length > 0" class="space-y-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
              AI Suggestions based on your description
            </label>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SuggestionCard
                v-for="suggestion in aiSuggestions"
                :key="suggestion.id"
                :suggestion="suggestion"
                @apply="applySuggestion"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Project Configuration -->
      <div v-if="currentStep === 1" class="p-8">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Configure your project
        </h2>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- Left Column -->
          <div class="space-y-6">
            <!-- Project Details -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Name
              </label>
              <input
                v-model="projectConfig.name"
                type="text"
                class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="my-awesome-app"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tech Stack
              </label>
              <TechStackSelector v-model="projectConfig.techStack" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Features
              </label>
              <FeatureSelector v-model="projectConfig.features" />
            </div>
          </div>

          <!-- Right Column - Preview -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Project Structure Preview
            </label>
            <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <ProjectStructurePreview :config="projectConfig" />
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Deployment Settings -->
      <div v-if="currentStep === 2" class="p-8">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Deployment Configuration
        </h2>

        <div class="space-y-6">
          <!-- Cloud Provider -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Cloud Provider
            </label>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ProviderCard
                v-for="provider in cloudProviders"
                :key="provider.id"
                :provider="provider"
                :selected="deploymentConfig.provider === provider.id"
                @select="deploymentConfig.provider = provider.id"
              />
            </div>
          </div>

          <!-- Environment Configuration -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Environment Variables
            </label>
            <EnvironmentVariablesEditor v-model="deploymentConfig.environment" />
          </div>

          <!-- Scaling Settings -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Auto-Scaling
            </label>
            <ScalingSettings v-model="deploymentConfig.scaling" />
          </div>
        </div>
      </div>

      <!-- Step 4: Review & Deploy -->
      <div v-if="currentStep === 3" class="p-8">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Review & Deploy
        </h2>

        <div class="space-y-6">
          <!-- Project Summary -->
          <ProjectSummary
            :description="projectDescription"
            :config="projectConfig"
            :deployment="deploymentConfig"
          />

          <!-- Cost Estimation -->
          <CostEstimation :config="deploymentConfig" />

          <!-- Deployment Progress -->
          <div v-if="isDeploying" class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
            <DeploymentProgress :progress="deploymentProgress" />
          </div>
        </div>
      </div>

      <!-- Navigation -->
      <div class="px-8 py-6 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
        <div class="flex justify-between">
          <button
            @click="previousStep"
            :disabled="currentStep === 0"
            class="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>

          <div class="flex space-x-3">
            <button
              @click="saveDraft"
              class="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Save Draft
            </button>

            <button
              v-if="currentStep < wizardSteps.length - 1"
              @click="nextStep"
              :disabled="!canProceed"
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Next →
            </button>

            <button
              v-else
              @click="deployProject"
              :disabled="!canDeploy || isDeploying"
              class="px-8 py-2 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
            >
              <span v-if="isDeploying" class="flex items-center">
                <div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                Deploying...
              </span>
              <span v-else>🚀 Deploy Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/tauri'

// Components
import WizardStep from './WizardStep.vue'
import TemplateCard from './TemplateCard.vue'
import SuggestionCard from './SuggestionCard.vue'
import TechStackSelector from './TechStackSelector.vue'
import FeatureSelector from './FeatureSelector.vue'
import ProjectStructurePreview from './ProjectStructurePreview.vue'
import ProviderCard from './ProviderCard.vue'
import EnvironmentVariablesEditor from './EnvironmentVariablesEditor.vue'
import ScalingSettings from './ScalingSettings.vue'
import ProjectSummary from './ProjectSummary.vue'
import CostEstimation from './CostEstimation.vue'
import DeploymentProgress from './DeploymentProgress.vue'

// Stores
import { useAppStore } from '../../stores/app'

const appStore = useAppStore()

// Wizard state
const currentStep = ref(0)
const projectDescription = ref('')
const selectedTemplate = ref(null)
const isAnalyzing = ref(false)
const isDeploying = ref(false)
const deploymentProgress = ref(0)

// Wizard steps
const wizardSteps = ref([
  { id: 'describe', name: 'Describe', icon: '💭' },
  { id: 'configure', name: 'Configure', icon: '⚙️' },
  { id: 'deploy', name: 'Deploy', icon: '🚀' },
  { id: 'review', name: 'Review', icon: '✅' }
])

// Project configuration
const projectConfig = ref({
  name: '',
  techStack: {
    frontend: 'react',
    backend: 'node',
    database: 'postgresql',
    hosting: 'vercel'
  },
  features: []
})

// Deployment configuration
const deploymentConfig = ref({
  provider: 'aws',
  environment: {},
  scaling: {
    minInstances: 1,
    maxInstances: 10,
    targetCPU: 70
  }
})

// AI suggestions
const aiSuggestions = ref([])

// Templates
const projectTemplates = ref([
  {
    id: 'social-media',
    name: 'Social Media App',
    description: 'Instagram-like app with photo sharing',
    icon: '📱',
    techStack: ['React', 'Node.js', 'PostgreSQL']
  },
  {
    id: 'ecommerce',
    name: 'E-commerce Store',
    description: 'Full-featured online store',
    icon: '🛒',
    techStack: ['Next.js', 'Stripe', 'MongoDB']
  },
  {
    id: 'saas',
    name: 'SaaS Platform',
    description: 'Multi-tenant SaaS application',
    icon: '💼',
    techStack: ['Vue.js', 'Python', 'PostgreSQL']
  }
])

// Cloud providers
const cloudProviders = ref([
  {
    id: 'aws',
    name: 'AWS',
    description: 'Amazon Web Services',
    icon: '☁️',
    pricing: '$0.10/hour'
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Optimal for frontend apps',
    icon: '▲',
    pricing: 'Free tier available'
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    description: 'Simple cloud computing',
    icon: '🌊',
    pricing: '$5/month'
  }
])

// Computed properties
const canProceed = computed(() => {
  switch (currentStep.value) {
    case 0: return projectDescription.value.trim().length > 0 || selectedTemplate.value
    case 1: return projectConfig.value.name.trim().length > 0
    case 2: return deploymentConfig.value.provider
    default: return true
  }
})

const canDeploy = computed(() => {
  return projectConfig.value.name && deploymentConfig.value.provider
})

// Methods
const analyzeProject = async () => {
  if (!projectDescription.value.trim()) return

  isAnalyzing.value = true
  try {
    const suggestions = await invoke('analyze_project_description', {
      description: projectDescription.value
    })
    aiSuggestions.value = suggestions
  } catch (error) {
    console.error('Failed to analyze project:', error)
  } finally {
    isAnalyzing.value = false
  }
}

const generateSuggestions = async () => {
  if (projectDescription.value.length < 20) return

  try {
    const suggestions = await invoke('get_ai_suggestions', {
      description: projectDescription.value
    })
    aiSuggestions.value = suggestions.slice(0, 4) // Show top 4
  } catch (error) {
    console.error('Failed to generate suggestions:', error)
  }
}

const selectTemplate = (template) => {
  selectedTemplate.value = template
  projectDescription.value = template.description
  projectConfig.value.name = template.name.toLowerCase().replace(/\s+/g, '-')
}

const applySuggestion = (suggestion) => {
  projectConfig.value = { ...projectConfig.value, ...suggestion.config }
}

const nextStep = () => {
  if (canProceed.value && currentStep.value < wizardSteps.length - 1) {
    currentStep.value++
  }
}

const previousStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const saveDraft = async () => {
  try {
    await invoke('save_project_draft', {
      description: projectDescription.value,
      config: projectConfig.value,
      deployment: deploymentConfig.value
    })
    console.log('Draft saved successfully')
  } catch (error) {
    console.error('Failed to save draft:', error)
  }
}

const deployProject = async () => {
  isDeploying.value = true
  deploymentProgress.value = 0

  try {
    // Start deployment
    const deploymentId = await invoke('start_project_deployment', {
      description: projectDescription.value,
      config: projectConfig.value,
      deployment: deploymentConfig.value
    })

    // Monitor progress
    const progressInterval = setInterval(async () => {
      try {
        const progress = await invoke('get_deployment_progress', { deploymentId })
        deploymentProgress.value = progress.percentage

        if (progress.status === 'completed') {
          clearInterval(progressInterval)
          isDeploying.value = false

          // Add project to store
          appStore.addProject({
            id: deploymentId,
            name: projectConfig.value.name,
            type: 'web-app',
            path: progress.url,
            status: 'active',
            url: progress.url,
            lastDeployed: new Date()
          })

          // Navigate to project
          window.location.href = '#/projects'
        } else if (progress.status === 'failed') {
          clearInterval(progressInterval)
          isDeploying.value = false
          console.error('Deployment failed:', progress.error)
        }
      } catch (error) {
        console.error('Failed to get deployment progress:', error)
      }
    }, 2000)

  } catch (error) {
    console.error('Failed to deploy project:', error)
    isDeploying.value = false
  }
}

// Watch for template selection
watch(selectedTemplate, (template) => {
  if (template) {
    projectConfig.value.techStack = {
      frontend: template.techStack[0].toLowerCase(),
      backend: template.techStack[1]?.toLowerCase() || 'node',
      database: template.techStack[2]?.toLowerCase() || 'postgresql',
      hosting: 'vercel'
    }
  }
})
</script>

<style scoped>
/* Custom animations for wizard */
.wizard-enter-active,
.wizard-leave-active {
  transition: all 0.3s ease;
}

.wizard-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.wizard-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>