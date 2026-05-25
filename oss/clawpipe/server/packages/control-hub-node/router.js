"use strict";

/**
 * Minimal router for the Control Hub Node server.
 * Maps (method, pathname) pairs to async handler functions.
 */
function makeRouter() {
  const routes = [];

  function add(method, pathname, handler) {
    routes.push({ method: method.toUpperCase(), pathname, handler });
  }

  return {
    get: (pathname, handler) => add("GET", pathname, handler),
    post: (pathname, handler) => add("POST", pathname, handler),
    put: (pathname, handler) => add("PUT", pathname, handler),
    delete: (pathname, handler) => add("DELETE", pathname, handler),

    async dispatch(req, res, pathname) {
      const method = (req.method || "GET").toUpperCase();
      for (const route of routes) {
        if (route.method === method && route.pathname === pathname) {
          await route.handler(req, res, pathname);
          return true;
        }
      }
      return false;
    },
  };
}

module.exports = { makeRouter };
