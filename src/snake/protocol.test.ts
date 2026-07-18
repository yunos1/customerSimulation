import { describe, expect, it } from "vitest";
import {
  applyActiveBoostCost,
  buildCollisionGrid,
  canActiveBoost,
  collisionBucketKey,
  findBodyHit,
  getRoomConfig,
  inViewRadius,
  normalizeAngle,
  normalizeRoomId,
  parseClientMessage,
  scoreAfterFood,
  shouldSendFullBody,
  SNAKE_FULL_BODY_RADIUS,
  SNAKE_HIT_RADIUS_SQ,
  SNAKE_PUBLIC_ROOMS,
} from "./protocol";

describe("collisionBucketKey", () => {
  it("buckets by floor division", () => {
    expect(collisionBucketKey(0, 0, 2)).toBe("0,0");
    expect(collisionBucketKey(1.9, 3.1, 2)).toBe("0,1");
    expect(collisionBucketKey(4, 5, 2)).toBe("2,2");
  });
});

describe("findBodyHit", () => {
  it("hits nearby foreign segment", () => {
    const grid = buildCollisionGrid([
      { id: "a", alive: true, body: [{ x: 10, y: 10 }, { x: 10, y: 11 }] },
      { id: "b", alive: true, body: [{ x: 10.2, y: 10.1 }] },
    ]);
    const hit = findBodyHit(grid, "b", 10.2, 10.1);
    expect(hit?.snakeId).toBe("a");
  });

  it("ignores own body", () => {
    const grid = buildCollisionGrid([
      { id: "a", alive: true, body: [{ x: 5, y: 5 }, { x: 5, y: 6 }] },
    ]);
    expect(findBodyHit(grid, "a", 5, 5)).toBeNull();
  });

  it("misses when outside radius", () => {
    const grid = buildCollisionGrid([
      { id: "a", alive: true, body: [{ x: 0, y: 0 }] },
    ]);
    // distance 1 > sqrt(0.64)=0.8
    expect(findBodyHit(grid, "b", 1, 0)).toBeNull();
  });

  it("respects hit radius constant", () => {
    expect(SNAKE_HIT_RADIUS_SQ).toBeCloseTo(0.64);
  });
});

describe("scoreAfterFood", () => {
  it("applies double multiplier", () => {
    expect(scoreAfterFood(10, 5, false)).toBe(15);
    expect(scoreAfterFood(10, 5, true)).toBe(20);
  });
});

describe("active boost", () => {
  it("gates on min length and score", () => {
    expect(canActiveBoost(8, 2, 8, 2)).toBe(true);
    expect(canActiveBoost(7, 10, 8, 2)).toBe(false);
    expect(canActiveBoost(10, 1, 8, 2)).toBe(false);
  });

  it("applies costs with floors", () => {
    expect(applyActiveBoostCost(10, 12, 2, 1, 8)).toEqual({ score: 8, length: 11 });
    expect(applyActiveBoostCost(1, 8, 2, 1, 8)).toEqual({ score: 0, length: 8 });
  });
});

describe("normalizeAngle", () => {
  it("wraps into [0,360)", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
  });
});

describe("AOI helpers", () => {
  it("shouldSendFullBody within radius", () => {
    expect(shouldSendFullBody(0, 0, 0, 0)).toBe(true);
    expect(shouldSendFullBody(0, 0, SNAKE_FULL_BODY_RADIUS, 0)).toBe(true);
    expect(shouldSendFullBody(0, 0, SNAKE_FULL_BODY_RADIUS + 1, 0)).toBe(false);
  });

  it("inViewRadius", () => {
    expect(inViewRadius(0, 0, 3, 4, 5)).toBe(true);
    expect(inViewRadius(0, 0, 3, 4, 4.9)).toBe(false);
  });
});

describe("parseClientMessage", () => {
  it("parses steer/boost/leave", () => {
    expect(parseClientMessage({ type: "leave" })).toEqual({ type: "leave" });
    expect(parseClientMessage({ type: "steer", angle: 90 })).toEqual({ type: "steer", angle: 90 });
    expect(parseClientMessage({ type: "boost", active: true })).toEqual({
      type: "boost",
      active: true,
    });
  });

  it("rejects garbage", () => {
    expect(parseClientMessage(null)).toBeNull();
    expect(parseClientMessage({ type: "steer" })).toBeNull();
    expect(parseClientMessage({ type: "boost", active: "yes" })).toBeNull();
    expect(parseClientMessage({ type: "noop" })).toBeNull();
  });
});

describe("normalizeRoomId", () => {
  it("accepts public room ids and custom codes", () => {
    expect(normalizeRoomId("main")).toBe("main");
    expect(normalizeRoomId("RELAX")).toBe("relax");
    expect(normalizeRoomId("party_01")).toBe("party_01");
    expect(SNAKE_PUBLIC_ROOMS.map((r) => r.id)).toContain("rush");
  });

  it("falls back to main for invalid ids", () => {
    expect(normalizeRoomId("")).toBe("main");
    expect(normalizeRoomId("bad room")).toBe("main");
    expect(normalizeRoomId("中文")).toBe("main");
    expect(normalizeRoomId("a".repeat(30))).toBe("main");
  });
});

describe("getRoomConfig", () => {
  it("returns distinct difficulty profiles", () => {
    expect(getRoomConfig("relax").botTarget).toBeLessThan(getRoomConfig("main").botTarget);
    expect(getRoomConfig("rush").foodTarget).toBeGreaterThan(getRoomConfig("main").foodTarget);
    expect(getRoomConfig("unknown_room").botTarget).toBe(getRoomConfig("main").botTarget);
  });
});
