// Copyright Zaiste. All rights reserved.
// Licensed under the Apache License, Version 2.0

import Debug from 'debug';
const debug = Debug('ks:index'); // eslint-disable-line no-unused-vars

import { join } from 'path';
import httpstatus from 'http-status';
import { ServerApp } from 'retes';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { Request, Response, Handler, Routes, Middleware, Pipeline, CompoundResponse } from 'retes';

import * as Endpoint from './endpoint';
import * as M from './middleware';
import { precompile, lookupViews } from './view';
import Logger from './logger';
import HTMLifiedError from './error';
import { setupControllersFromFilesystem } from './core';
import { print, notice } from './util';

const cwd = process.cwd();

const Env = {
  get isProduction() {
    return process.env.KRETES === 'production';
  },
};

const handleError = (request: Request) => (error) => {
  const { response } = request;

  response.statusCode = 500;
  error.status = `500 ${httpstatus[500]}`;

  // TODO remove at runtime in `production`, keep only in `development`
  Logger.printRequestResponse(request);
  Logger.printError(error, 'HTTP');

  const htmlifiedError = new HTMLifiedError(error, request);

  htmlifiedError.generate().then((html) => {
    response.writeHead(500, { 'Content-Type': 'text/html' }).end(html);
  });
};

const append = (context) => () => Logger.printRequestResponse(context);

export default class Kretes extends ServerApp {
  staticDir: string;
  routePaths: Object;
  isDatabase: boolean;
  isGraphQL: boolean;
  snowpack: SnowpackDevServer | undefined;

  constructor({
    staticDir = join(cwd, 'static'),
    graphql = false,
    implicitControllers = true,
    WebRPC = true,
    isDatabase = true,
    _verbose = false,
    routes = [] as Routes,
    middlewares = [] as Middleware[],
    snowpack = null,
  } = {}) {
    super(routes, middlewares, handleError, append);

    this.isGraphQL = graphql;
    this.staticDir = staticDir;
    this.isDatabase = isDatabase;
    this.snowpack = snowpack;
  }

  async setup() {
    if (this.isGraphQL) {
      try {
        const { types: typeDefs, resolvers } = await import(
          `${join(cwd, '.compiled', 'site', '_api', 'index')}.js`
        );

        this.add(
          'POST',
          '/_api',
          await Endpoint.GraphQL({
            schema: makeExecutableSchema({ typeDefs, resolvers }),
          })
        );
        this.add('GET', '/_graphiql', await Endpoint.GraphiQL());

        print(notice('OK')('GraphQL'));
      } catch (error) {
        print(notice('Error')('GraphQL')(error));
        print(notice('Explain')(error));
      }
    }

    if (this.isDatabase) {
      // enable Postgraphile
    }

    this.add('GET', '/_api.json', () => Endpoint.OpenAPI(this.routePaths));
    this.add('GET', '/_api', () => Endpoint.RedocApp());

    // FIXME Doesn't work
    // App.DatabasePool.on('error', error => {
    //   console.log("boo")
    // })

    if (process.env.NODE_ENV === 'production') {
      const views = await lookupViews();
      const parts = join(cwd, 'views/parts');
      precompile(views, { paths: [parts] });
    }

    setupControllersFromFilesystem(this);

    this.use(M.Security());
    this.use(M.CORS());
    if (this.snowpack) {
      this.use(M.ServerSideRenderer(this.snowpack.getServerRuntime()));
    }
    this.use(M.Routing(this.router));
    this.use(M.Caching());
    this.use(M.Serve(this.staticDir));
    this.use(M.Extractor());
    if (process.env.KRETES != 'production' && process.env.KRETES != 'test') {
      // middlewares to run ONLY in Development
      this.use(M.Snowpack(this.snowpack));
      this.use(M.SPA(this.routes));
    }
  }
}

// Kretes Modules
// TODO https://github.com/microsoft/TypeScript/issues/33079

// import {
//   auth,
//   background,
//   database,
//   request,
//   response,
//   view,
// } from 'kretes';

export * as auth from './auth';
export * as background from './background';
export * as request from './request';
export * as response from './response';
export * as view from './view';
// export * as webrpc from './webrpc';
// export * as http from './http';

import database from './db';
export { database };

import Schema from 'validate';
import { SnowpackDevServer } from 'snowpack';
export { Schema };

export type { Request, Response, CompoundResponse, Handler, Routes, Middleware, Pipeline, Env };
