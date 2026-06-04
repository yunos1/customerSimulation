import { customers } from "./customers";
import { possibleEvents } from "./events";
import { policies } from "./policies";
import { replyCards } from "./replyCards";
import type { LevelConfig } from "../game/types";

export const activeDay: LevelConfig = {
  id: "internship-day-01",
  title: "实习第 1 天",
  briefing: "你被分配到售后接待席位。目标是稳住客户，也别把公司预算当灭火器。",
  baseMetrics: {
    satisfaction: 50,
    anger: 50,
    companyCost: 0,
    complianceRisk: 10,
    timeLeft: 160,
  },
  customers,
  replyCards,
  policies,
  possibleEvents,
};
