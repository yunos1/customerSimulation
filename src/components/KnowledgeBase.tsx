import { BookOpen, Tag } from "lucide-react";
import { memo } from "react";
import type { PolicyEntry } from "../game/types";

interface KnowledgeBaseProps {
  policies: PolicyEntry[];
}

// 政策数据在一局内恒定，memo 让它跳过每秒 tick 引发的重渲染。
export const KnowledgeBase = memo(function KnowledgeBase({ policies }: KnowledgeBaseProps) {
  return (
    <section className="panel compact-panel knowledge-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">知识库</p>
          <h2>政策速查</h2>
        </div>
        <BookOpen size={20} aria-hidden="true" />
      </div>

      <div className="policy-list">
        {policies.map((policy) => (
          <article className="policy-item" key={policy.id}>
            <div className="policy-title-row">
              <h3>{policy.title}</h3>
              <span>{policy.category}</span>
            </div>
            <p>{policy.body}</p>
            <div className="tag-row">
              <Tag size={13} aria-hidden="true" />
              {policy.relatedTags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
});
