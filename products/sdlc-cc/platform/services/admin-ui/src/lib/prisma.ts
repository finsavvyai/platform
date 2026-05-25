// Prisma client stub - replace with actual Prisma client when database is configured
const globalForPrisma = globalThis as unknown as {
  prisma: unknown
}

export const prisma: unknown =
  globalForPrisma.prisma ??
  (() => {
    // Stub that returns a proxy for any property access
    const handler: ProxyHandler<object> = {
      get: (_target, prop) => {
        if (typeof prop === 'string') {
          return new Proxy({}, {
            get: () => {
              return async () => null
            },
          })
        }
        return undefined
      },
    }
    return new Proxy({}, handler)
  })()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
