import { z } from "zod";
import type { json, UnionToIntersection } from "./helper";
import type { CookieOptions, CookiePrefixOptions } from "./cookie";
import type { APIError } from "./error";
import { Header } from 'encore.dev/api';


type BaseBody = {
  cookie: Header<"Set-Cookie">
}
export interface EndpointOptions<Body = any, Query = any> {
  /**
   * Request Method
   */
  method: Method | Method[];
  /**
   * Body Schema
   */
  body?: Body extends undefined ? undefined : Body extends BaseBody ? Body : Body & BaseBody;
  /**
   * Query Schema
   */
  query?: Query;
  /**
   * If true headers will be required to be passed in the context
   */
  requireHeaders?: boolean;
  /**
   * If true request object will be required
   */
  requireRequest?: boolean;
  /**
   * List of endpoints that will be called before this endpoint
   */
  use?: Endpoint[];
  /**
   * Endpoint metadata
   */
  metadata?: {
    /**
     * If true this endpoint will only be available on the server
     */
    SERVER_ONLY?: boolean;
    $Infer?: {
      body?: Record<string, any>;
    };
    [key: string]: any;
  };
}

export type Endpoint<
  Handler extends (ctx: any) => Promise<any> = (ctx: any) => Promise<any>,
  Option extends EndpointOptions<any, any> = EndpointOptions<any, any>,
> = {
  path: string;
  options: Option;
  headers?: Headers;
} & Handler;

export type InferParamPath<Path> = Path extends `${infer _Start}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof InferParamPath<Rest>]: string }
  : Path extends `${infer _Start}:${infer Param}`
  ? { [K in Param]: string }
  : Path extends `${infer _Start}/${infer Rest}`
  ? InferParamPath<Rest>
  : undefined;

export type InferParamWildCard<Path> = Path extends
  | `${infer _Start}/*:${infer Param}/${infer Rest}`
  | `${infer _Start}/**:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof InferParamPath<Rest>]: string }
  : Path extends `${infer _Start}/*`
  ? { [K in "_"]: string }
  : Path extends `${infer _Start}/${infer Rest}`
  ? InferParamPath<Rest>
  : undefined;

export type Prettify<T> = {
  [key in keyof T]: T[key];
} & {};

export type ContextTools = {
  /**
   * the current path
   */
  path: string;
  /**
   * Set header
   *
   * If it's called outside of a request it will just be ignored.
   */
  setHeader: (key: string, value: string) => void;
  /**
   * cookie setter.
   *
   * If it's called outside of a request it will just be ignored.
   */
  setCookie: (key: string, value: string, options?: CookieOptions) => void;
  /**
   * Get cookie value
   *
   * If it's called outside of a request it will just be ignored.
   */
  getCookie: (key: string, prefix?: CookiePrefixOptions) => string | undefined;
  /**
   * Set signed cookie
   */
  setSignedCookie: (
    key: string,
    value: string,
    secret: string | BufferSource,
    options?: CookieOptions,
  ) => Promise<void>;
  /**
   * Get signed cookie value
   */

  getSignedCookie: (
    key: string,
    secret: string,
    prefix?: CookiePrefixOptions,
  ) => Promise<string | undefined>;
  /**
   * Redirect to url
   */
  redirect: (url: string) => APIError;
  /**
   * json response helper
   */
  json: typeof json;
  /**
   * response header
   */
  responseHeader: Headers;
};

export type Context<Path extends string, Opts extends EndpointOptions<any, any>> = InferBody<Opts> &
  InferParam<Path> &
  InferMethod<Opts["method"]> &
  InferHeaders<Opts> &
  InferRequest<Opts> &
  InferQuery<Opts["query"]> & {
    /**
     * This is used internally.
     * But you can use it to change the response form.
     *
     * - `json` will be set only when using `ctx.json` helper.
     * - `router` will be set when the handler is called from the router.
     * You can use this to change the response form to be a `Response` object.
     * - `default` will be used normally when the handler is called as a normal function.
     *
     * @internal
     */
    _flag?: "json" | "router" | "default";
    /**
     * Force the response to be a `Response` object.
     */
    asResponse?: boolean;
  };

export type InferUse<Opts extends EndpointOptions<any, any>["use"]> = Opts extends Endpoint[]
  ? {
    context: UnionToIntersection<Awaited<ReturnType<Opts[number]>>>;
  }
  : {};

export type InferUseOptions<Opts extends EndpointOptions<any, any>> = Opts["use"] extends Array<infer U>
  ? UnionToIntersection<
    U extends Endpoint
    ? U["options"]
    : {
      body?: {};
      requireRequest?: boolean;
      requireHeaders?: boolean;
    }
  >
  : {
    body?: {};
    requireRequest?: boolean;
    requireHeaders?: boolean;
  };

export type InferMethod<M extends Method | Method[]> = M extends Array<Method>
  ? {
    method: M[number];
  }
  : {
    method?: M;
  };

export type InferHeaders<
  Opt extends EndpointOptions<any, any>,
  HeaderReq = Opt["requireHeaders"],
> = HeaderReq extends true
  ? {
    headers: Headers;
  }
  : InferUseOptions<Opt>["requireHeaders"] extends true
  ? {
    headers: Headers;
  }
  : {
    headers?: Headers;
  };

export type InferRequest<
  Opt extends EndpointOptions<any, any>,
  RequestReq = Opt["requireRequest"],
> = RequestReq extends true
  ? {
    request: Request;
  }
  : InferUseOptions<Opt>["requireRequest"] extends true
  ? {
    request: Request;
  }
  : {
    request?: Request;
  };

export type InferQuery<Query> = Query extends unknown
  ? {
    query?: Query;
  }
  : {
    query: Query;
  };

export type InferParam<
  Path extends string,
  ParamPath extends InferParamPath<Path> = InferParamPath<Path>,
  WildCard extends InferParamWildCard<Path> = InferParamWildCard<Path>,
> = ParamPath extends undefined
  ? WildCard extends undefined
  ? {
    params?: Record<string, string>;
  }
  : {
    params: WildCard;
  }
  : {
    params: Prettify<ParamPath & (WildCard extends undefined ? {} : WildCard)>;
  };

export type EndpointBody =
  | Record<string, any>
  | string
  | boolean
  | number
  | void
  | undefined
  | null
  | unknown;

export type EndpointResponse =
  | {
    response: {
      status?: number;
      statusText?: string;
      headers?: Headers;
      body: any;
    };
    body: EndpointBody;
    _flag: "json";
  }
  | EndpointBody;

export type Handler<
  Path extends string,
  Opts extends EndpointOptions<any, any>,
  R extends EndpointResponse,
> = (ctx: Prettify<Context<Path, Opts> & InferUse<Opts["use"]> & ContextTools>) => Promise<R>;

export type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "*";

// InferBody without Zod (using generics instead)
export type InferBody<
  Opts extends EndpointOptions<any, any>,
  Body = Opts["body"]
> = Opts["metadata"] extends { $Infer: { body: infer B } }
  ? { body: B }  // Use $Infer.body from metadata if available
  : Body extends undefined
  ? { body?: undefined }  // If body is undefined, the body is also undefined
  : Body extends object
  ? { body: Body }  // If Body is a generic object type, it becomes required
  : { body?: undefined };