import { TransactionTypePage } from "./TransactionTypePage";

export function InboundPage() {
  return <TransactionTypePage type="IN" />;
}

export function OutboundPage() {
  return <TransactionTypePage type="OUT" />;
}
