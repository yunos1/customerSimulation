import type { PolicyEntry } from "../game/types";

export const policies: PolicyEntry[] = [
  {
    id: "refund-7-days",
    title: "7 天无理由退款",
    category: "售后",
    body: "签收 7 天内、商品不影响二次销售时，可申请无理由退款；定制类、已拆封耗材和虚拟商品不适用。",
    relatedTags: ["policy", "refund_check"],
  },
  {
    id: "quality-refund",
    title: "质量问题处理",
    category: "售后",
    body: "疑似质量问题需先收集照片、订单号和批次信息。核实后可退款、换货或补发。",
    relatedTags: ["investigate", "refund_check"],
  },
  {
    id: "lost-package",
    title: "物流异常",
    category: "物流",
    body: "物流 48 小时无更新可发起追踪工单；超过 96 小时无结果时，可申请补发或退款审核。",
    relatedTags: ["logistics", "investigate"],
  },
  {
    id: "coupon-limit",
    title: "优惠补偿上限",
    category: "补偿",
    body: "单次会话小额补偿不超过 20 元；同一用户 30 天内最多一次无责补偿。",
    relatedTags: ["compensation", "policy"],
  },
  {
    id: "escalation",
    title: "主管介入条件",
    category: "升级",
    body: "涉及威胁投诉、媒体曝光、批量订单或政策例外时，应申请主管协助，不得私自承诺。",
    relatedTags: ["supervisor", "policy"],
  },
];
