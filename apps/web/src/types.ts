export interface ParamDoc {
  name: string;
  in: 'query' | 'body' | 'path' | 'header';
  type: string;
  required?: boolean;
  default?: string;
  description: string;
  example?: string;
}

export interface EndpointDoc {
  id: string;
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  title: string;
  tag: 'general' | 'brat' | 'auth' | 'keys' | 'account';
  description: string;
  auth: 'none' | 'api_key' | 'session';
  params: ParamDoc[];
  response: string;
  examples: { curl: string; js?: string; python?: string };
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: 'free' | 'pro';
  provider: string;
  createdAt: string;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  prefix: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  requests: number;
  masked?: string;
  key?: string;
}

export interface UsageDay {
  day: string;
  total: number;
  byEndpoint: Record<string, number>;
}

export interface BratParams {
  text: string;
  size?: number;
  width?: number;
  height?: number;
  background?: string;
  color?: string;
  blur?: number;
  bold?: boolean;
  italic?: boolean;
  transform?: 'lower' | 'upper' | 'none';
  align?: 'left' | 'center' | 'right';
  padding?: number;
  radius?: number;
  lineHeight?: number;
  tracking?: number;
  fontSize?: number;
  format?: 'png' | 'jpeg' | 'webp' | 'svg';
  quality?: number;
  download?: boolean;
}
