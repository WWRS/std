// deno-lint-ignore-file no-console
// Copyright 2018-2025 the Deno authors. MIT license.

import { walk } from "../fs/walk.ts";
import { relative } from "../path/relative.ts";
import { dirname } from "../path/dirname.ts";
import * as colors from "../fmt/colors.ts";
import ts from "npm:typescript";
import { isTestFile } from "./utils.ts";

const ROOT = new URL("../", import.meta.url);
const FAIL_FAST = Deno.args.includes("--fail-fast");

let shouldFail = false;

for await (
  const { path: modFilePath } of walk(ROOT, {
    includeDirs: true,
    exts: ["ts"],
    match: [/(\/|\\)mod\.ts$/],
    maxDepth: 2,
  })
) {
  const modSource = await Deno.readTextFile(modFilePath);
  const modSourceFile = ts.createSourceFile(
    modFilePath,
    modSource,
    ts.ScriptTarget.Latest,
  );
  const modExportSpecifiers = new Set();
  modSourceFile.forEachChild((node) => {
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      modExportSpecifiers.add(node.moduleSpecifier.text);
    }
  });

  for await (
    const { path: filePath } of walk(dirname(modFilePath), {
      exts: [".ts"],
      includeDirs: false,
      maxDepth: 1,
      skip: [
        /unstable/,
        /dotenv(\/|\\)load\.ts$/,
        /front_matter(\/|\\)yaml\.ts$/,
        /front_matter(\/|\\)json\.ts$/,
        /front_matter(\/|\\)toml\.ts$/,
        /front_matter(\/|\\)any\.ts$/,
        /uuid(\/|\\)v1\.ts$/,
        /uuid(\/|\\)v3\.ts$/,
        /uuid(\/|\\)v4\.ts$/,
        /uuid(\/|\\)v5\.ts$/,
        /uuid(\/|\\)v6\.ts$/,
        /uuid(\/|\\)v7\.ts$/,
        /_test\.ts$/,
        /_bench\.ts$/,
        /\.d\.ts$/,
        /(\/|\\)_/,
        /mod\.ts$/,
      ],
    })
  ) {
    const relativeSpecifier = relative(modFilePath, filePath).slice(1)
      .replaceAll("\\", "/");

    if (!modExportSpecifiers.has(relativeSpecifier)) {
      if (isTestFile(filePath)) continue;

      console.warn(
        `${
          colors.yellow("Warn")
        } ${modFilePath} does not export '${relativeSpecifier}'.`,
      );
      shouldFail = true;
      if (FAIL_FAST) Deno.exit(1);
    }
  }
}

if (shouldFail) Deno.exit(1);
