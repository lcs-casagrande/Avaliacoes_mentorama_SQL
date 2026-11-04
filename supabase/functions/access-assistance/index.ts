import { createAccessAssistanceHandler } from './handler.mjs';
Deno.serve(createAccessAssistanceHandler({readEnv: name => Deno.env.get(name)}));
