{{/*
Expand the name of the chart.
*/}}
{{- define "quantumbeam.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "quantumbeam.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "quantumbeam.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "quantumbeam.labels" -}}
helm.sh/chart: {{ include "quantumbeam.chart" . }}
{{ include "quantumbeam.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "quantumbeam.selectorLabels" -}}
app.kubernetes.io/name: {{ include "quantumbeam.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "quantumbeam.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "quantumbeam.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create image name
*/}}
{{- define "quantumbeam.image" -}}
{{- $registry := .Values.global.imageRegistry | default .Values.image.registry -}}
{{- $repository := .Values.image.repository -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion -}}
{{- if .Values.global.imageRegistry }}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- else -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end -}}
{{- end }}

{{/*
API Server image
*/}}
{{- define "quantumbeam.apiServer.image" -}}
{{- $registry := .Values.global.imageRegistry | default .Values.apiServer.image.registry | default .Values.image.registry -}}
{{- $repository := .Values.apiServer.image.repository -}}
{{- $tag := .Values.apiServer.image.tag | default .Chart.AppVersion -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}

{{/*
Quantum Service image
*/}}
{{- define "quantumbeam.quantumService.image" -}}
{{- $registry := .Values.global.imageRegistry | default .Values.quantumService.image.registry | default .Values.image.registry -}}
{{- $repository := .Values.quantumService.image.repository -}}
{{- $tag := .Values.quantumService.image.tag | default .Chart.AppVersion -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}

{{/*
AI/ML Service image
*/}}
{{- define "quantumbeam.aiMlService.image" -}}
{{- $registry := .Values.global.imageRegistry | default .Values.aiMlService.image.registry | default .Values.image.registry -}}
{{- $repository := .Values.aiMlService.image.repository -}}
{{- $tag := .Values.aiMlService.image.tag | default .Chart.AppVersion -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- end }}

{{/*
Database connection string
*/}}
{{- define "quantumbeam.databaseUrl" -}}
{{- if .Values.postgresql.enabled -}}
{{- printf "postgres://%s:%s@%s:%d/%s?sslmode=%s" .Values.postgresql.auth.username .Values.postgresql.auth.password (include "quantumbeam.postgresql.fullname" .) .Values.postgresql.primary.service.ports.postgresql .Values.postgresql.auth.database (.Values.postgresql.primary.sslMode | default "require") -}}
{{- else -}}
{{- .Values.apiServer.config.databaseUrl -}}
{{- end -}}
{{- end }}

{{/*
Redis connection string
*/}}
{{- define "quantumbeam.redisUrl" -}}
{{- if .Values.redis.enabled -}}
{{- printf "redis://%s:%d" (include "quantumbeam.redis.fullname" .) .Values.redis.master.service.ports.redis -}}
{{- else -}}
{{- .Values.apiServer.config.redisUrl -}}
{{- end -}}
{{- end }}

{{/*
PostgreSQL fullname
*/}}
{{- define "quantumbeam.postgresql.fullname" -}}
{{- if .Values.postgresql.fullnameOverride -}}
{{- .Values.postgresql.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default "postgresql" .Values.postgresql.nameOverride -}}
{{- printf "%s-%s" (include "quantumbeam.fullname" .) $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{/*
Redis fullname
*/}}
{{- define "quantumbeam.redis.fullname" -}}
{{- if .Values.redis.fullnameOverride -}}
{{- .Values.redis.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default "redis" .Values.redis.nameOverride -}}
{{- printf "%s-%s" (include "quantumbeam.fullname" .) $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end }}

{{/*
Return the proper Docker Image Registry Secret Names
*/}}
{{- define "quantumbeam.imagePullSecrets" -}}
{{- include "common.images.pullSecrets" (dict "images" (list .Values.apiServer.image .Values.quantumService.image .Values.aiMlService.image) "global" .Values.global) -}}
{{- end }}

{{/*
Create a default fully qualified api server name.
*/}}
{{- define "quantumbeam.apiServer.fullname" -}}
{{- printf "%s-%s" (include "quantumbeam.fullname" .) "api-server" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified quantum service name.
*/}}
{{- define "quantumbeam.quantumService.fullname" -}}
{{- printf "%s-%s" (include "quantumbeam.fullname" .) "quantum-service" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified ai-ml service name.
*/}}
{{- define "quantumbeam.aiMlService.fullname" -}}
{{- printf "%s-%s" (include "quantumbeam.fullname" .) "ai-ml-service" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
API Server labels
*/}}
{{- define "quantumbeam.apiServer.labels" -}}
helm.sh/chart: {{ include "quantumbeam.chart" . }}
{{ include "quantumbeam.apiServer.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
API Server selector labels
*/}}
{{- define "quantumbeam.apiServer.selectorLabels" -}}
app.kubernetes.io/name: {{ include "quantumbeam.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: api-server
{{- end }}

{{/*
Quantum Service labels
*/}}
{{- define "quantumbeam.quantumService.labels" -}}
helm.sh/chart: {{ include "quantumbeam.chart" . }}
{{ include "quantumbeam.quantumService.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Quantum Service selector labels
*/}}
{{- define "quantumbeam.quantumService.selectorLabels" -}}
app.kubernetes.io/name: {{ include "quantumbeam.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: quantum-service
{{- end }}

{{/*
AI/ML Service labels
*/}}
{{- define "quantumbeam.aiMlService.labels" -}}
helm.sh/chart: {{ include "quantumbeam.chart" . }}
{{ include "quantumbeam.aiMlService.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
AI/ML Service selector labels
*/}}
{{- define "quantumbeam.aiMlService.selectorLabels" -}}
app.kubernetes.io/name: {{ include "quantumbeam.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: ai-ml-service
{{- end }}

{{/*
Return the configuration configmap name
*/}}
{{- define "quantumbeam.configMapName" -}}
{{- if .Values.existingConfigMap -}}
{{- .Values.existingConfigMap -}}
{{- else -}}
{{- default (include "quantumbeam.fullname" .) .Values.configMapNameOverride -}}
{{- end -}}
{{- end }}

{{/*
Return the secrets name
*/}}
{{- define "quantumbeam.secretsName" -}}
{{- if .Values.existingSecret -}}
{{- .Values.existingSecret -}}
{{- else -}}
{{- default (include "quantumbeam.fullname" .) .Values.secretsNameOverride -}}
{{- end -}}
{{- end }}

{{/*
Validate values
*/}}
{{- define "quantumbeam.validateValues" -}}
{{- $messages := list -}}
{{- if not .Values.apiServer.secrets.jwtSecret -}}
{{- $messages = append $messages "API Server JWT secret is required" -}}
{{- end -}}
{{- if not .Values.quantumService.secrets.ibmQuantumToken -}}
{{- $messages = append $messages "Quantum Service IBM Quantum token is required" -}}
{{- end -}}
{{- if not .Values.aiMlService.secrets.openaiApiKey -}}
{{- $messages = append $messages "AI/ML Service OpenAI API key is required" -}}
{{- end -}}
{{- if $messages -}}
{{- printf "\nVALUES VALIDATION:\n%s" (join "\n" $messages) | fail -}}
{{- end -}}
{{- end -}}