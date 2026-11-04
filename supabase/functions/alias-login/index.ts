import { createAliasLoginHandler } from './handler.mjs';
Deno.serve(createAliasLoginHandler({ readEnv: name => Deno.env.get(name) }));
