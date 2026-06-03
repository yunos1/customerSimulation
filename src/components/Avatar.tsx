import { Headset } from "lucide-react";
import type { Customer } from "../game/types";

interface CustomerAvatarProps {
  customer: Customer;
  size?: "sm" | "md" | "lg";
}

interface AgentAvatarProps {
  size?: "sm" | "md" | "lg";
}

const customerAvatarCount = 8;

export function CustomerAvatar({ customer, size = "md" }: CustomerAvatarProps) {
  const variant = getCustomerAvatarVariant(customer.id);

  return (
    <span
      aria-label={`${customer.name}头像`}
      className={`avatar avatar-${size} avatar-customer avatar-variant-${variant}`}
      title={customer.name}
    >
      <span>{customer.name.slice(0, 1)}</span>
    </span>
  );
}

export function AgentAvatar({ size = "md" }: AgentAvatarProps) {
  return (
    <span aria-label="客服头像" className={`avatar avatar-${size} avatar-agent`} title="客服">
      <Headset size={size === "sm" ? 15 : 18} aria-hidden="true" />
    </span>
  );
}

function getCustomerAvatarVariant(id: string) {
  let hash = 0;

  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return hash % customerAvatarCount;
}
