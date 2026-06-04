import { describe, expect, it } from "vitest";
import { buildRandomizedCustomers } from "./customerGenerator";
import { defaultCustomerCount } from "./balance";
import type { Customer } from "./types";

// 生成器是 seeded 确定性的——同 seed 必出相同客户。
// 这保证 StrictMode 双调用与重放可重现，也是 Phase 1 加难度曲线前的行为基线。

const fallback: Customer[] = [];

describe("buildRandomizedCustomers", () => {
  it("同 seed 产出完全相同的客户列表", () => {
    const a = buildRandomizedCustomers(fallback, 12345);
    const b = buildRandomizedCustomers(fallback, 12345);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("不同 seed 通常产出不同客户列表", () => {
    const a = buildRandomizedCustomers(fallback, 1);
    const b = buildRandomizedCustomers(fallback, 999);

    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("默认生成 defaultCustomerCount 个客户", () => {
    const customers = buildRandomizedCustomers(fallback, 42);

    expect(customers).toHaveLength(defaultCustomerCount);
    expect(defaultCustomerCount).toBe(6);
  });

  it("每个客户都有非空 id、name 和至少一轮对话", () => {
    const customers = buildRandomizedCustomers(fallback, 7);

    for (const customer of customers) {
      expect(customer.id).toBeTruthy();
      expect(customer.name).toBeTruthy();
      expect(customer.rounds.length).toBeGreaterThan(0);
    }
  });

  it("客户 id 互不重复", () => {
    const customers = buildRandomizedCustomers(fallback, 314);
    const ids = new Set(customers.map((customer) => customer.id));

    expect(ids.size).toBe(customers.length);
  });
});

describe("generation 配置", () => {
  it("customerCount 控制生成数量", () => {
    const seven = buildRandomizedCustomers(fallback, 42, { customerCount: 7 });
    const eight = buildRandomizedCustomers(fallback, 42, { customerCount: 8 });

    expect(seven).toHaveLength(7);
    expect(eight).toHaveLength(8);
  });

  it("scenarioPool 限制只生成池内场景", () => {
    const customers = buildRandomizedCustomers(fallback, 99, {
      customerCount: 4,
      scenarioPool: ["lost-package"],
    });

    // lost-package 场景的 type 是 lost_package。
    for (const customer of customers) {
      expect(customer.type).toBe("lost_package");
    }
  });

  it("metricOffsets 叠加到客户初始指标上（加难）", () => {
    const base = buildRandomizedCustomers(fallback, 7, { customerCount: 3 });
    const harder = buildRandomizedCustomers(fallback, 7, {
      customerCount: 3,
      metricOffsets: { satisfaction: -8, anger: 8 },
    });

    // 同 seed、同数量，仅 offset 不同：偏移应使满意度更低、怒气更高（注意 clamp 到 0-100）。
    for (let index = 0; index < base.length; index += 1) {
      expect(harder[index].initialMetrics.satisfaction).toBeLessThanOrEqual(
        base[index].initialMetrics.satisfaction,
      );
      expect(harder[index].initialMetrics.anger).toBeGreaterThanOrEqual(
        base[index].initialMetrics.anger,
      );
    }
  });

  it("typeWeights 偏向高权重类型（统计意义上）", () => {
    // 给 policy_checker 极高权重，生成大量客户后该类型应占多数。
    const customers = buildRandomizedCustomers(fallback, 2024, {
      customerCount: 20,
      typeWeights: { policy_checker: 100 },
    });
    const policyCount = customers.filter((c) => c.type === "policy_checker").length;

    expect(policyCount).toBeGreaterThan(customers.length / 2);
  });
});

