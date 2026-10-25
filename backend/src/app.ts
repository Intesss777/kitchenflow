// Must run before imports that construct schemas. Keep the auto-compile side effect backend-only:
// browser runtimes should not invoke eval-like code generation.
import 'zod/compile'

import { OpenAPIHono } from '@hono/zod-openapi'
import { except } from 'hono/combine'
import { cors } from 'hono/cors'
import { secureHeaders } from 'hono/secure-headers'

import { createBackgroundTasks, type TaskDeferrer } from './background-tasks'
import type { DbClient } from './db'
import { disabledEmailDelivery, type EmailDelivery } from './email'
import type { AppEnv } from './env'
import { errorResponse, handleError, validationErrorHook } from './http/errors'
import { createReadinessProbe } from './http/readiness'
import { createAuthSecurity, createFixedWindowRateLimit } from './http/security'
import { createAuthModule, type AuthHttpEnv } from './modules/auth'
import { createAccessModule } from './modules/access'
import { createDishesModule } from './modules/dishes'
import { createInventoryModule } from './modules/inventory'
import { createInvoicesModule } from './modules/invoices'
import { createOperationsModule } from './modules/operations'
import { createPurchasesModule } from './modules/purchases'
import { createStaffModule } from './modules/staff'
import { createShiftsModule } from './modules/shifts'
import { createUploadsModule } from './modules/uploads'
import { createUsersModule } from './modules/users'
import { createWorkspaceModule } from './modules/workspace'
import { createRateLimitStores } from './rate-limit'
import {
  apiCorsAllowedHeaders,
  browserUploadExposedHeaders,
  createPrivateStorage,
  type PrivateStorageRuntime,
} from './storage'

type CreateAppOptions = {
  backgroundTasks?: TaskDeferrer
  emailDelivery?: EmailDelivery
  env: AppEnv
  prisma: DbClient
  /**
   * Storage is never absent: the filesystem driver always works. Injectable so tests can point
   * it at a temporary directory instead of the configured root.
   */
  privateStorage?: PrivateStorageRuntime
}

export function createApp({
  backgroundTasks = createBackgroundTasks(),
  emailDelivery = disabledEmailDelivery,
  env,
  prisma,
  privateStorage,
}: CreateAppOptions) {
  const storage = privateStorage ?? createPrivateStorage(env)
  const auth = createAuthModule({ db: prisma, emailDelivery, env })
  const requireWorkspace = auth.requireWorkspaceRole('owner', 'chef', 'administrator')
  const requireKitchen = auth.requireWorkspaceRole('owner', 'chef')
  const requireFinance = auth.requireWorkspaceRole('owner', 'administrator')
  const requireOwner = auth.requireWorkspaceRole('owner')
  // One store per policy, in memory or in PostgreSQL as RATE_LIMIT_STORE says; the middleware
  // never learns which.
  const rateLimitStore = createRateLimitStores(env, prisma)
  const adminUsersReadRateLimit = createFixedWindowRateLimit<AuthHttpEnv>({
    errorMessage: 'Too many admin user directory requests',
    key: (c) => c.var.user.id,
    max: env.ADMIN_USERS_READ_RATE_LIMIT_MAX,
    store: rateLimitStore('admin-users-read'),
    windowSeconds: env.ADMIN_USERS_READ_RATE_LIMIT_WINDOW_SECONDS,
  })
  const users = createUsersModule({
    adminUsersReadRateLimit,
    db: prisma,
    requireAuth: auth.requireAuth,
    requireOwner: auth.requireWorkspaceRoleOrUnscopedAdmin('owner'),
  })
  const access = createAccessModule({
    db: prisma,
    requireAuth: auth.requireAuth,
    requireOwner,
  })
  const workspace = createWorkspaceModule({
    db: prisma,
    requireAuth: auth.requireAuth,
    requireOwner,
  })
  const uploads = createUploadsModule({
    backgroundTasks,
    db: prisma,
    requireAuth: auth.requireAuth,
    storage: storage.storage,
  })
  const operations = createOperationsModule({
    db: prisma,
    requireAuth: auth.requireAuth,
    requireFinance,
    requireOwner,
  })
  const inventory = createInventoryModule({
    db: prisma,
    requireAuth: auth.requireAuth,
    requireWorkspace,
  })
  const dishes = createDishesModule({
    db: prisma,
    requireAuth: auth.requireAuth,
    requireKitchen,
    storage: storage.storage,
  })
  const invoices = createInvoicesModule({
    db: prisma,
    requireAuth: auth.requireAuth,
    requireFinance,
    storage: storage.storage,
  })
  const purchases = createPurchasesModule({
    db: prisma,
    requireAuth: auth.requireAuth,
    requireWorkspace,
  })
  const staff = createStaffModule({
    db: prisma,
    requireAuth: auth.requireAuth,
    requireKitchen,
  })
  const shifts = createShiftsModule({
    db: prisma,
    requireAuth: auth.requireAuth,
    requireKitchen,
    storage: storage.storage,
  })
  const app = new OpenAPIHono<AuthHttpEnv>({
    defaultHook: validationErrorHook,
  })
  app.openAPIRegistry.registerComponent('securitySchemes', 'BearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  })

  // Signed local-storage reads are intentionally embedded by the webapp on its separate
  // development origin. Register this before secureHeaders so its post-response override runs
  // last, while every other route keeps the stricter same-origin policy.
  app.use('*', async (c, next) => {
    await next()
    if (
      storage.httpRoutes
      && (c.req.method === 'GET' || c.req.method === 'HEAD')
      && c.req.path.startsWith('/storage/objects/')
    ) {
      c.header('Cross-Origin-Resource-Policy', 'cross-origin')
    }
  })
  app.use(secureHeaders())
  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return env.CORS_ORIGINS[0] ?? null
        return env.CORS_ORIGINS.includes(origin) ? origin : null
      },
      // One global CORS layer, because hono answers a preflight in the first middleware that
      // matches: a second, route-scoped cors() registered later would never see an OPTIONS.
      // The upload headers therefore have to live here. They come from the same constant the
      // local S3 bucket's CORS rule uses, so both drivers allow exactly the same upload request.
      allowHeaders: apiCorsAllowedHeaders,
      exposeHeaders: browserUploadExposedHeaders,
      allowMethods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: true,
      maxAge: 600,
    }),
  )
  // Signing in has its own budget. Every other API route shares the account budget, so a new
  // route is limited without an edit. Both budgets are the same size, keyed by client address.
  const authSecurity = (policy: 'auth' | 'account') =>
    createAuthSecurity({
      bodyLimitBytes: env.AUTH_BODY_LIMIT_BYTES,
      rateLimitMax: env.AUTH_RATE_LIMIT_MAX,
      rateLimitWindowSeconds: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
      store: rateLimitStore(policy),
      trustProxy: env.TRUST_PROXY,
      trustedProxyClientIpHeader: env.TRUSTED_PROXY_CLIENT_IP_HEADER,
      trustedProxyClientIpPosition: env.TRUSTED_PROXY_CLIENT_IP_POSITION,
    })
  for (const middleware of authSecurity('auth')) {
    app.use('/api/auth/*', middleware)
  }
  app.use('/api/*', except('/api/auth/*', ...authSecurity('account')))
  app.get('/', (c) => {
    return c.json({
      name: 'KitchenFlow backend',
      status: 'ok',
    })
  })

  app.get('/health', (c) => {
    return c.json({
      status: 'ok',
    })
  })

  app.get('/health/live', (c) => {
    return c.json({
      status: 'ok',
    })
  })

  // Readiness is the one database-backed route that no limiter covers, so it answers from one
  // probe per second rather than one query per request. One second is invisible to the platform
  // checks that poll every 10 s, and it caps what an unauthenticated GET flood can cost the pool.
  const databaseReady = createReadinessProbe({
    check: () => prisma.$queryRaw`SELECT 1`,
    windowMs: 1_000,
  })
  app.get('/health/ready', async (c) => {
    return (await databaseReady())
      ? c.json({ status: 'ok' }, 200)
      : c.json({ status: 'unavailable' }, 503)
  })

  app.route('/api/auth', auth.routes)
  app.route('/api/access', access)
  app.route('/api/workspace', workspace)
  app.route('/api/users', users.userRoutes)
  app.route('/api/admin', users.adminRoutes)
  app.route('/api/uploads', uploads.routes)
  app.route('/api/operations', operations)
  app.route('/api/inventory', inventory)
  app.route('/api/dishes', dishes)
  app.route('/api/invoices', invoices)
  app.route('/api/purchases', purchases)
  app.route('/api/staff', staff)
  app.route('/api/shifts', shifts)

  // Only the filesystem driver needs the backend to serve the URLs it signs. With an S3 driver
  // the browser uploads straight to the bucket and there is nothing to mount here.
  if (storage.httpRoutes) {
    app.route('/storage', storage.httpRoutes)
  }

  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      title: 'KitchenFlow API',
      version: '1.0.0',
    },
  })

  app.notFound((c) => c.json(errorResponse('NOT_FOUND', 'Route not found'), 404))
  app.onError(handleError)

  return app
}

export type AppType = ReturnType<typeof createApp>
