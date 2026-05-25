{{- define "pipewarden.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "pipewarden.fullname" -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "pipewarden.labels" -}}
app.kubernetes.io/name: {{ include "pipewarden.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "pipewarden.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pipewarden.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "pipewarden.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "pipewarden.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "pipewarden.vaultSecretName" -}}
{{- if .Values.vault.existingSecret -}}
{{- .Values.vault.existingSecret -}}
{{- else -}}
{{- printf "%s-vault" (include "pipewarden.fullname" .) -}}
{{- end -}}
{{- end -}}
