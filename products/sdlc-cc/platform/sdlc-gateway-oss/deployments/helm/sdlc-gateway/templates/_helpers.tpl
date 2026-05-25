{{- define "sdlc-gateway.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "sdlc-gateway.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "sdlc-gateway.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "sdlc-gateway.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{ include "sdlc-gateway.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "sdlc-gateway.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sdlc-gateway.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
