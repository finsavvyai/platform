/**
 * Session Durable Object
 *
 * Handles user session management
 */

export class SessionDO {
  constructor(
    private state: DurableObjectState,
    private env: any,
  ) {}

  async fetch(request: Request): Promise<Response> {
    return new Response("Session DO coming soon");
  }
}
