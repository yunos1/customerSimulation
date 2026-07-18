import { defaultCustomerCount, difficultyPresets } from "./balance";
import { realisticScenarios, scenarioSets, type ScenarioTemplate } from "./scenarios";
import type {
  Customer,
  CustomerRound,
  DayGenerationConfig,
} from "./types";

const shiftCustomerCount = defaultCustomerCount;

export function buildRandomizedCustomers(
  baseCustomers: Customer[],
  seed: number,
  generation: DayGenerationConfig = { customerCount: shiftCustomerCount },
) {
  const rng = createRng(seed);
  const selectedScenarios = buildShiftScenarios(rng, generation);

  // 将 difficultyPreset 的 metricOffsets 与关卡自身的 metricOffsets 叠加。
  const presetOffsets = generation.difficultyPreset
    ? difficultyPresets[generation.difficultyPreset].metricOffsets
    : undefined;
  const mergedOffsets =
    presetOffsets || generation.metricOffsets
      ? {
          satisfaction: (presetOffsets?.satisfaction ?? 0) + (generation.metricOffsets?.satisfaction ?? 0),
          anger: (presetOffsets?.anger ?? 0) + (generation.metricOffsets?.anger ?? 0),
        }
      : undefined;

  const generatedCustomers = selectedScenarios.map((scenario, index) =>
    buildCustomer(scenario, rng, seed, index, mergedOffsets),
  );

  return generatedCustomers.length > 0 ? generatedCustomers : baseCustomers;
}

function buildShiftScenarios(rng: () => number, generation: DayGenerationConfig) {
  const count = generation.customerCount;
  const sourceScenarios = scenarioSets[generation.scenarioSet ?? "realistic"] ?? realisticScenarios;
  const pool =
    generation.scenarioPool && generation.scenarioPool.length > 0
      ? sourceScenarios.filter((scenario) => generation.scenarioPool?.includes(scenario.id))
      : sourceScenarios;
  const effectivePool = pool.length > 0 ? pool : sourceScenarios;

  // 无权重时保持原行为：shuffle 后取前 count，再按需补足。
  // 这条默认路径的 RNG 调用序列与重构前完全一致，确保 Phase 0 快照不变。
  if (!generation.typeWeights) {
    const selectedScenarios = shuffle(effectivePool, rng).slice(0, count);

    while (selectedScenarios.length < count) {
      selectedScenarios.push(pick(effectivePool, rng));
    }

    return selectedScenarios;
  }

  // 有权重时按权重抽样（偏向更难类型）。
  const selectedScenarios: ScenarioTemplate[] = [];

  while (selectedScenarios.length < count) {
    selectedScenarios.push(pickWeighted(effectivePool, rng, generation.typeWeights));
  }

  return selectedScenarios;
}

function pickWeighted(
  items: ScenarioTemplate[],
  rng: () => number,
  typeWeights: NonNullable<DayGenerationConfig["typeWeights"]>,
) {
  const weights = items.map((scenario) => typeWeights[scenario.type] ?? 1);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let threshold = rng() * total;

  for (let index = 0; index < items.length; index += 1) {
    threshold -= weights[index];

    if (threshold <= 0) {
      return items[index];
    }
  }

  return items[items.length - 1];
}

function buildCustomer(
  scenario: ScenarioTemplate,
  rng: () => number,
  seed: number,
  index: number,
  metricOffsets?: DayGenerationConfig["metricOffsets"],
): Customer {
  const name = pick(scenario.names, rng);
  const issue = pick(scenario.issues, rng);
  const idSeed = Math.abs(Math.floor((seed + index + 1) * 9973 * rng()));
  const rounds = scenario.rounds.map((round, roundIndex): CustomerRound => ({
    id: `${scenario.id}-r${roundIndex + 1}-${idSeed}`,
    prompt: pick(round.prompts, rng),
    preferredTags: round.preferredTags,
    riskyTags: round.riskyTags,
    successLine: pick(round.successLines, rng),
    neutralLine: pick(round.neutralLines, rng),
    failureLine: pick(round.failureLines, rng),
    resolveAfter: round.resolveAfter,
  }));

  return {
    id: `${scenario.id}-${idSeed}-${index}`,
    name,
    handle: pick(scenario.handles, rng),
    type: scenario.type,
    issue,
    opening: pick(scenario.openings, rng),
    // metricOffsets 在 randomInt 之后叠加，不引入新的 RNG 调用，故默认路径序列不变。
    initialMetrics: {
      satisfaction: clampMetric(
        scenario.initialMetrics.satisfaction + randomInt(rng, -8, 8) + (metricOffsets?.satisfaction ?? 0),
      ),
      anger: clampMetric(
        scenario.initialMetrics.anger + randomInt(rng, -8, 8) + (metricOffsets?.anger ?? 0),
      ),
    },
    patience: clampMetric(scenario.patience + randomInt(rng, -10, 10)),
    profileNotes: sample(scenario.profileNotes, 3, rng),
    rounds,
  };
}

function pick<T>(items: T[], rng: () => number) {
  return items[Math.floor(rng() * items.length)];
}

function sample<T>(items: T[], count: number, rng: () => number) {
  return shuffle(items, rng).slice(0, Math.min(count, items.length));
}

function shuffle<T>(items: T[], rng: () => number) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function randomInt(rng: () => number, min: number, max: number) {
  return min + Math.floor(rng() * (max - min + 1));
}

function clampMetric(value: number) {
  return Math.max(0, Math.min(100, value));
}

function createRng(seed: number) {
  let state = Math.abs(Math.floor(seed)) % 2147483647;

  if (state === 0) {
    state = 1;
  }

  return () => {
    state = (state * 48271) % 2147483647;

    return state / 2147483647;
  };
}
