import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import app, { openApiDocumentConfig } from "../app";

const outputPath = resolve(process.cwd(), "openapi.json");

const openApiDocument = app.getOpenAPI31Document(openApiDocumentConfig);

await writeFile(outputPath, `${JSON.stringify(openApiDocument, null, 2)}\n`);
console.log(`OpenAPI document written to ${outputPath}`);
