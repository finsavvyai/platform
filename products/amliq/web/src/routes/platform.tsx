import React from 'react'
import { Route } from 'react-router-dom'
import { PlatformOverview, PlatformUsers, PlatformAPIKeys } from './lazyPlatform'

type PWrapper = ({ children }: { children: React.ReactNode }) => JSX.Element

export function platformRoutes(P: PWrapper) {
  return (
    <>
      <Route path="/platform/overview" element={<P><PlatformOverview /></P>} />
      <Route path="/platform/users" element={<P><PlatformUsers /></P>} />
      <Route path="/platform/keys" element={<P><PlatformAPIKeys /></P>} />
    </>
  )
}
