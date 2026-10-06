import { realDeps } from '../_shared/context.ts';
import { createHandler } from './handler.ts';

Deno.serve(createHandler(realDeps()));
