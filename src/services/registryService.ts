import * as https from "node:https";
import * as semver from "semver";

import type { DependencyRecord } from "../models/dependency";
import {
  determineDependencyStatus,
  findLatestVersionInCurrentMajor,
  hasMajorUpdate
} from "./registryUtils";

interface RegistryMetadata {
  "dist-tags"?: {
    latest?: string;
  };
  versions?: Record<string, unknown>;
}

interface CachedVersion {
  latestVersion: string;
  stableVersions: string[];
  fetchedAt: number;
}

const REGISTRY_BASE_URL = "https://registry.npmjs.org";
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 4000;
const MAX_CONCURRENT_REQUESTS = 8;

export class RegistryService {
  // 版本信息短时间变化不频繁，做一个内存缓存可以避免每次展开视图都重新请求全部依赖。
  private readonly latestVersionCache = new Map<string, CachedVersion>();

  async enrichDependencies(
    dependencies: DependencyRecord[]
  ): Promise<DependencyRecord[]> {
    // 这里保留原始依赖结构，只额外补充 latestVersion/status 等信息，
    // 这样视图层不需要关心 registry 的请求细节。
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
      const { latestVersion, stableVersions } =
        await this.getPackageVersions(dependency.name);
      const latestSafeVersion = findLatestVersionInCurrentMajor(
        dependency.declaredVersion,
        stableVersions
      );
      const dependencyHasMajorUpdate = hasMajorUpdate(
        dependency.declaredVersion,
        latestVersion
      );
      // declaredVersion 可能是 ^1.2.3、~1.2.3、workspace:* 等形式，
      // 所以这里单独做一次 semver 判断，而不是直接比较字符串。
      const status = determineDependencyStatus(
        dependency.declaredVersion,
        latestVersion
      );

      return {
        ...dependency,
        latestVersion,
        latestSafeVersion,
        hasMajorUpdate: dependencyHasMajorUpdate,
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

  private async getPackageVersions(
    packageName: string
  ): Promise<{ latestVersion: string; stableVersions: string[] }> {
    const cached = this.latestVersionCache.get(packageName);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return {
        latestVersion: cached.latestVersion,
        stableVersions: cached.stableVersions
      };
    }

    // npm registry 会在 dist-tags.latest 里给出当前默认稳定版本。
    const metadata = await this.fetchRegistryMetadata(packageName);
    const latestVersion = metadata["dist-tags"]?.latest;
    if (!latestVersion) {
      throw new Error("npm registry did not return a latest version.");
    }
    const stableVersions = Object.keys(metadata.versions ?? {}).filter(
      (version): version is string => semver.valid(version) !== null
    );

    this.latestVersionCache.set(packageName, {
      latestVersion,
      stableVersions,
      fetchedAt: Date.now()
    });

    return {
      latestVersion,
      stableVersions
    };
  }

  private async fetchRegistryMetadata(
    packageName: string
  ): Promise<RegistryMetadata> {
    const packageUrl = `${REGISTRY_BASE_URL}/${encodeURIComponent(packageName)}`;

    return new Promise<RegistryMetadata>((resolve, reject) => {
      // 这里直接发 HTTPS 请求，而不是调用 npm outdated，
      // 目的是拿到更稳定的结构化数据，也避免解析终端文本输出。
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

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  // 一个非常轻量的并发控制器：
  // 同一时刻只让固定数量的请求并行执行，避免依赖过多时瞬间打爆网络请求。
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
