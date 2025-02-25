import { APIError } from "./error";
import { json, type HasRequiredKeys } from "./helper";
import type {
  Context,
  ContextTools,
  Endpoint,
  EndpointOptions,
  EndpointResponse,
  Handler,
  InferUse,
  Prettify,
} from "./types";
import { getCookie, getSignedCookie, setCookie, setSignedCookie } from "./cookie-utils";
import type { CookiePrefixOptions, CookieOptions } from "./cookie";

export interface EndpointConfig {
  /**
   * Throw when the response isn't in 200 range
   */
  throwOnError?: boolean;
}

export function createEndpointCreator<
  A = any, // Default type for A is `any`
  B = any, // Default type for B is `any`
  E extends { use?: Endpoint[] } = {}, // Default type for E is empty
>(opts?: E) {
  return <
    Path extends string, // Path type
    Opts extends EndpointOptions<A, B>, // Options that extend `EndpointOptions<A, B>`
    R extends EndpointResponse, // Response type
  >(
    path: Path,
    options: Opts, // Options
    handler: (
      ctx: Prettify<
        Context<Path, Opts> & // Context for the given path and options
        InferUse<Opts["use"]> & // Infer use from options
        InferUse<E["use"]> & // Infer use from E
        Omit<ContextTools, "_flag"> // Omit unwanted fields
      >,
    ) => Promise<R>, // Handler returns a promise
  ) => {
    return createEndpoint(
      path,
      {
        ...options,
        use: [...(options?.use || []), ...(opts?.use || [])], // Safely merge `use` arrays
      },
      handler,
    );
  };
}


export function createEndpoint<
  Path extends string,
  Opts extends EndpointOptions,
  R extends EndpointResponse,
>(path: Path, options: Opts, handler: Handler<Path, Opts, R>) {
  let responseHeader = new Headers();
  type Ctx = Context<Path, Opts>;
  const handle = async <C extends HasRequiredKeys<Ctx> extends true ? [Ctx] : [Ctx?]>(
    ...ctx: C
  ) => {
    let internalCtx = {
      setHeader(key: string, value: string) {
        responseHeader.set(key, value);
      },
      setCookie(key: string, value: string, options?: CookieOptions) {
        setCookie(responseHeader, key, value, options);
      },
      getCookie(key: string, prefix?: CookiePrefixOptions) {
        const header = ctx[0]?.headers;
        const cookieH = header?.get("cookie");
        const cookie = getCookie(cookieH || "", key, prefix);
        return cookie;
      },
      getSignedCookie(key: string, secret: string, prefix?: CookiePrefixOptions) {
        const header = ctx[0]?.headers;
        if (!header) {
          throw new TypeError("Headers are required");
        }
        const cookie = getSignedCookie(header, secret, key, prefix);
        return cookie;
      },
      async setSignedCookie(
        key: string,
        value: string,
        secret: string | BufferSource,
        options?: CookieOptions,
      ) {
        await setSignedCookie(responseHeader, key, value, secret, options);
      },
      redirect(url: string) {
        responseHeader.set("Location", url);
        return new APIError("FOUND");
      },
      json,
      context: (ctx[0] as any)?.context || {},
      _flag: (ctx[0] as any)?.asResponse ? "router" : (ctx[0] as any)?._flag,
      responseHeader,
      path: path,
      ...(ctx[0] || {}),
    };
    if (options.use?.length) {
      let middlewareContexts = {};
      let middlewareBody = {};
      for (const middleware of options.use) {
        if (typeof middleware !== "function") {
          console.warn("Middleware is not a function", {
            middleware,
          });
          continue;
        }
        const res = (await middleware(internalCtx)) as Endpoint;
        if (res) {
          const body = res.options?.body || undefined;
          middlewareContexts = {
            ...middlewareContexts,
            ...res,
          };
          middlewareBody = {
            ...middlewareBody,
            ...body,
          };
        }
      }
      internalCtx = {
        ...internalCtx,
        body: {
          ...middlewareBody,
          ...(internalCtx.body as Record<string, any>),
        },
        context: {
          ...(internalCtx.context || {}),
          ...middlewareContexts,
        },
      };
    }
    try {
      const body = options.body ? options.body : internalCtx.body;
      internalCtx = {
        ...internalCtx,
        body: body
          ? {
            ...body,
            ...(internalCtx.body as Record<string, any>),
          }
          : internalCtx.body,
      };
      internalCtx.query = options.query
        ? options.query
        : internalCtx.query;
    } catch (e) {
      throw e;
    }
    if (options.requireHeaders && !internalCtx.headers) {
      throw new APIError("BAD_REQUEST", {
        message: "Headers are required",
      });
    }
    if (options.requireRequest && !internalCtx.request) {
      throw new APIError("BAD_REQUEST", {
        message: "Request is required",
      });
    }
    // If request is provided but headers are not provided
    // then set headers from request
    if (internalCtx.request && !internalCtx.headers) {
      internalCtx.headers = internalCtx.request.headers;
    }
    try {
      let res = (await handler(internalCtx as any)) as any;
      let actualResponse: any = res;

      if (res && typeof res === "object" && "_flag" in res) {
        if (res._flag === "json" && internalCtx._flag === "router") {
          const h = res.response.headers as Record<string, string>;
          Object.keys(h || {}).forEach((key) => {
            responseHeader.set(key, h[key as keyof typeof h]);
          });
          responseHeader.set("Content-Type", "application/json");
          actualResponse = new Response(JSON.stringify(res.response.body), {
            status: res.response.status ?? 200,
            statusText: res.response.statusText,
            headers: responseHeader,
          });
        } else {
          actualResponse = res.body;
        }
      }

      responseHeader = new Headers();

      type ReturnT = Awaited<ReturnType<Handler<Path, Opts, R>>>;
      return actualResponse as C extends [{ asResponse: true }]
        ? Response
        : R extends {
          _flag: "json";
        }
        ? R extends { body: infer B }
        ? B
        : null
        : ReturnT;
    } catch (e) {
      if (e instanceof APIError) {
        responseHeader.set("Content-Type", "application/json");
        e.headers = responseHeader;
        responseHeader = new Headers();
        throw e;
      }
      throw e;
    }
  };
  handle.path = path;
  handle.options = options;
  handle.method = options.method;
  handle.headers = responseHeader;
  return handle;
}