export const appVersion = import.meta.env.VITE_APP_VERSION ?? 'dev'
export const gitSha = import.meta.env.VITE_GIT_SHA ?? 'unknown'
export const builtAt = import.meta.env.VITE_BUILT_AT ?? 'unknown'

export const versionTooltip = `version: ${appVersion}\nrevision: ${gitSha}\nbuilt: ${builtAt}`
