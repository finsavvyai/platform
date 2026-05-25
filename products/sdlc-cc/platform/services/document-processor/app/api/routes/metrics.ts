import { Router, Request, Response } from 'express';

export class MetricsRouter {
  public router: Router;

  constructor() {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get('/', (_req: Request, res: Response) => {
      res.set('Content-Type', 'text/plain');
      res.send('# Metrics endpoint placeholder\n');
    });
  }
}
