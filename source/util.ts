// Copyright Zaiste. All rights reserved.
// Licensed under the Apache License, Version 2.0

import Path from 'path';
import { spawn } from 'child_process';
import * as _ from 'colorette';
import FS from 'fs-extra';

export const print = (message: string) => {
  process.stdout.write(message);
};

export const println = (message: string = '') => {
  console.log(message);
};

export function pick(obj, keys) {
  return keys.reduce((acc, k) => {
    acc[k] = obj[k];
    return acc;
  }, {});
}

export function isObject(_) {
  return !!_ && typeof _ === 'object';
  //return !!_ && _.constructor === Object;
}

//const isObject = _ => !!_ && _.constructor === Object;

export const substitute = (template, data) => {
  const start = '{{';
  const end = '}}';
  const path = '[a-z0-9_$][\\.a-z0-9_]*';
  const pattern = new RegExp(start + '\\s*(' + path + ')\\s*' + end, 'gi');

  return template.replace(pattern, (tag, token) => {
    let path = token.split('.');
    let len = path.length;
    let lookup = data;
    let i = 0;

    for (; i < len; i++) {
      lookup = lookup[path[i]];

      if (lookup === undefined) {
        throw new Error(`substitue: '${path[i]}' not found in '${tag}'`);
      }

      if (i === len - 1) {
        return lookup;
      }
    }
  });
};

export const compose =
  (...functions) =>
  (args) =>
    functions.reduceRight((arg, fn) => fn(arg), args);

export const toBuffer = async (stream) => {
  const chunks = [];
  for await (let chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

export const streamToString = async (stream) => {
  let chunks = '';

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => (chunks += chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(chunks));
  });
};

export const parseCookies = (cookieHeader = '') => {
  const cookies = cookieHeader.split(/; */);
  const decode = decodeURIComponent;

  if (cookies[0] === '') return {};

  const result = {};
  for (let cookie of cookies) {
    const isKeyValue = cookie.includes('=');

    if (!isKeyValue) {
      result[cookie.trim()] = true;
      continue;
    }

    let [key, value] = cookie.split('=');

    key.trim();
    value.trim();

    if ('"' === value[0]) value = value.slice(1, -1);

    try {
      value = decode(value);
    } catch (error) {
      // neglect
    }

    result[key] = value;
  }

  return result;
};

export const parseAcceptHeader = ({ accept = '*/*' }) => {
  const preferredType = accept.split(',').shift();
  const format = preferredType.split('/').pop();

  return format;
};

export const generateSourceMap = (input) => {
  if (!input) {
    return '';
  }
  if (typeof input !== 'string') {
    input = JSON.stringify(input);
  }

  const map = Buffer.from(input).toString('base64');
  return `\n//# sourceMappingURL=data:application/json;base64,${map}`;
};

interface Options {
  stdin?: 'ignore' | 'inherit' | 'pipe' | number;
  stdout?: 'inherit' | 'pipe' | number;
  stderr?: 'inherit' | 'pipe' | number;
  cwd?: string;
  env?: any;
}

export const run = async (
  command,
  args,
  { stdin = 'ignore', stdout = 'inherit', stderr = 'inherit', cwd = '.', env = {} }: Options = {}
): Promise<void> => {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: [stdin, stdout, stderr],
      env: { ...process.env, ...env },
      cwd,
    });
    child.on('exit', (code) => {
      if (code) reject(new Error('exit code 1'));
      else resolve();
    });
  });
};

import { green, red, gray, magenta, underline, cyan, blue, bold, yellow } from 'colorette';
import * as explain from './explainer';
const VERSION = require('../package.json').version;

const TemplateNaming = {
  react: 'React.js',
  vue: 'Vue.js',
  svelte: 'Svelte',
  solid: 'Solid.js',
  preact: 'Preact',
};

const Display = {
  OK: (name) => `${gray(name.padStart(10))}  ${green('OK')}\n`,
  Error: (name) => (error) => `${gray(name.padStart(10))}  ${red('Error:')} ${error.message}\n`,
  Kretes: `${bold(blue('Kretes'.padStart(10)))}  ${bold(VERSION)}\n`,
  New: (dir, template) =>
    `${magenta('new'.padStart(10))}  creating a project in '${underline(dir)}'${
      template !== 'base' ? ` using the ${underline(TemplateNaming[template])} template` : ''
    }\n`,
  Deps: `${magenta('new'.padStart(10))}  installing dependencies\n`,
  ESM: `${gray('ESM'.padStart(10))}  `,
  Build: `${gray('Build'.padStart(10))}  `,
  Snowpack: `${gray('Snowpack'.padStart(10))}  ${green('OK')}\n`,
  TypeScript: `${gray('TypeScript'.padStart(10))}  ${green('OK')}\n`,
  CSS: `${gray('CSS'.padStart(10))}  ${green('OK')}\n`,
  Listening: (port) => `${gray('Started on'.padStart(10))}  ${underline(`http://localhost:${port}`)}\n`,
  Logs: `${gray('\n----- Logs\n\n'.padStart(10))}`,
  Explain: (error) => `${gray('->')} ${explain.forError(error)}\n`,
  Finish: (dir) =>
    `${magenta('new'.padStart(10))}  Success! Run '${underline(`cd ${dir}`)}' and then '${underline(
      'kretes start'
    )}' (or just '${underline('ks s')}')\n`,
};

export const notice = (message) => Display[message] || '';

export const interpolate = (template: string, vars: object = {}) => {
  const handler = new Function(
    'vars',
    [
      'const tagged = ( ' + Object.keys(vars).join(', ') + ' ) =>',
      '`' + template + '`',
      'return tagged(...Object.values(vars))',
    ].join('\n')
  );

  return handler(vars);
};

export const isDatabaseConfigured = async () => {
  const { default: config } = await import('config'); // defer the config loading
  const { PGHOST, PGPORT, PGDATABASE, PGDATA } = process.env;
  return config.has('db') || (PGHOST && PGPORT && PGDATABASE && PGDATA);
};

export const __compiled = (location: string) => Path.join(process.cwd(), `.compiled/${location}.js`);

export const __source = (location: string) => Path.join(process.cwd(), `${location}.ts`);

export async function exists(path) {
  try {
    await FS.access(path);
    return true;
  } catch {
    return false;
  }
}
