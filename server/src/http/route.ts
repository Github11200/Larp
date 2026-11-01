// Binds a shared RouteDef to a handler: validates the body, scopes to the user, validates the response.
import type { BodyOut, ResOf, RouteDef } from "@larp/shared";
import { USER_HEADER } from "@larp/shared";
import type { Request, Response, Router } from "express";
import { z } from "zod";
import { NotFound } from "../lib/store";

export interface RouteInput<D extends RouteDef> {
  userId: string;
  params: Record<string, string>;
  body: BodyOut<D>;
}

export const userIdOf = (req: Request) => (req.header(USER_HEADER) || "demo").slice(0, 64);

export function handle<D extends RouteDef>(
  router: Router,
  def: D,
  fn: (input: RouteInput<D>) => Promise<ResOf<D> | z.input<D["res"]>>,
) {
  const method = def.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
  router[method](def.path, async (req: Request, res: Response) => {
    try {
      const body = def.body ? def.body.parse(req.body) : undefined;
      const out = await fn({ userId: userIdOf(req), params: req.params as Record<string, string>, body } as RouteInput<D>);
      res.json(def.res.parse(out));
    } catch (e) {
      if (e instanceof z.ZodError) return void res.status(400).json({ error: z.prettifyError(e) });
      if (e instanceof NotFound) return void res.status(404).json({ error: `not found: ${e.message}` });
      console.error(`[${def.method} ${def.path}]`, e);
      res.status(500).json({ error: String(e) });
    }
  });
}
