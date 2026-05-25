{{/*
Common labels
*/}}
{{- define "sdlc-platform.labels" -}}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: sdlc-platform
{{- end }}

{{/*
Selector labels for a component
*/}}
{{- define "sdlc-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
Full image name
*/}}
{{- define "sdlc-platform.image" -}}
{{ .global.imageRegistry }}/{{ .image.repository }}:{{ .image.tag }}
{{- end }}

{{/*
Service account name
*/}}
{{- define "sdlc-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default .Chart.Name .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
