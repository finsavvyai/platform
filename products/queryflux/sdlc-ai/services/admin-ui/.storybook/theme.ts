import type { Addon_Preview_React } from '@storybook/react'
import { create } from '@storybook/theming/create'

export const lightTheme = create({
  base: 'light',
  brandTitle: 'SDLC.ai Admin UI',
  brandUrl: 'https://sdlc.ai',
  brandImage: '/logo.svg',
})

export const darkTheme = create({
  base: 'dark',
  brandTitle: 'SDLC.ai Admin UI',
  brandUrl: 'https://sdlc.ai',
  brandImage: '/logo-dark.svg',
})
