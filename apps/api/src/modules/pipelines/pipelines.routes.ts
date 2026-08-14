/**
 * Cleaning pipeline — stillflow-shaped logical plan validate + bounded preview.
 * Public in local studio mode: the sample asset contains no secrets.
 */
import { Hono } from "hono";
import { secureRouter } from "../../lib/secure-router";
import * as ctrl from "./pipelines.controller";

const r = secureRouter(new Hono(), {
  module: "pipelines",
  basePath: "/api/pipelines",
});

r.public(
  "get",
  "/catalog",
  { reason: "Studio node catalog and sample asset schema — no secrets" },
  ctrl.catalog,
);

r.public(
  "post",
  "/validate",
  { reason: "Validate a stillflow logical-plan DAG before preview" },
  ctrl.validate,
);

r.public(
  "post",
  "/preview",
  { reason: "Bounded tabular preview of a stillflow logical plan (sample asset only)" },
  ctrl.preview,
);

export const pipelineRoutes = r.hono;
