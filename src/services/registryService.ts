import * as https from "node:https";

import * as semver from "semver";

import { DependencyRecord, DependencyStatus } from "../models/dependency";

interface RegistryMetadata {
  "dist-tags"?: {
    latest?: string;
  };
}

interface CachedVersion {
  latestVersion: string;
  fetchedAt: number;
}

const REGISTRY_BASE_URL = "https://registry.npmjs.org";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4000;
const MAX_CONCURRENT_REQUESTS = 8;

export class RegistryService {
  private readonly latestVersionCache = new Map<string, CachedVersion>();

  async enrichDependencies(
    dependencies: DependencyRecord[]
  ): Promise<DependencyRecord[]> {
    return mapWithConcurrency(
      dependencies,
      MAX_CONCURRENT_REQUESTS,
      async (dependency) => this.enrichDependency(dependency)
    );
  }

  private async enrichDependency(
    dependency: DependencyRecord
  ): Promise<DependencyRecord> {
    try {
      const latestVersion = await this.getLatestVersion(dependency.name);
      const status = determineDependencyStatus(
        dependency.declaredVersion,
        latestVersion
      );

      return {
        ...dependency,
        latestVersion,
        status,
        errorMessage:
          status === "unknown"
            ? "The declared version is not a standard semver range."
            : undefined
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      return {
        ...dependency,
        status: "error",
        errorMessage: message
      };
    }
  }

  private async getLatestVersion(packageName: string): Promise<string> {
    const cached = this.latestVersionCache.get(packageName);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.latestVersion;
    }

    const metadata = await this.fetchRegistryMetadata(packageName);
    const latestVersion = metadata["dist-tags"]?.latest;
    if (!latestVersion) {
      throw new Error("npm registry did not return a latest version.");
    }

    this.latestVersionCache.set(packageName, {
      latestVersion,
      fetchedAt: Date.now()
    });

    return latestVersion;
  }

  private async fetchRegistryMetadata(
    packageName: string
  ): Promise<RegistryMetadata> {
    const packageUrl = `${REGISTRY_BASE_URL}/${encodeURIComponent(packageName)}`;

    return new Promise<RegistryMetadata>((resolve, reject) => {
      const request = https.get(
        packageUrl,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "package-vision"
          },
          timeout: REQUEST_TIMEOUT_MS
        },
        (response) => {
          const chunks: Uint8Array[] = [];

          response.on("data", (chunk: Uint8Array) => {
            chunks.push(chunk);
          });

          response.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf-8");
            const statusCode = response.statusCode ?? 500;

            if (statusCode < 200 || statusCode >= 300) {
              reject(
                new Error(
                  `npm registry request failed with status ${statusCode}.`
                )
              );
              return;
            }

            try {
              resolve(JSON.parse(body) as RegistryMetadata);
            } catch {
              reject(new Error("npm registry returned invalid JSON."));
            }
          });
        }
      );

      request.on("timeout", () => {
        request.destroy(new Error("npm registry request timed out."));
      });

      request.on("error", (error) => {
        reject(error);
      });
    });
  }
}

function determineDependencyStatus(
  declaredVersion: string,
  latestVersion: string
): DependencyStatus {
  const normalizedRange = normalizeSemverRange(declaredVersion);
  if (!normalizedRange) {
    return "unknown";
  }

  return semver.satisfies(latestVersion, normalizedRange)
    ? "upToDate"
    : "outdated";
}

function normalizeSemverRange(range: string): string | undefined {
  const validRange = semver.validRange(range);
  return validRange ?? undefined;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  let currentIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (currentIndex < items.length) {
        const itemIndex = currentIndex;
        currentIndex += 1;
        results[itemIndex] = await mapper(items[itemIndex], itemIndex);
      }
    }
  );

  await Promise.all(workers);
  return results;
}
