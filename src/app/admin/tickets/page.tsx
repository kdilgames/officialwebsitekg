import { LifeBuoy } from "lucide-react";

import { TicketReplyForm } from "@/components/admin/admin-forms";
import { ActionButton } from "@/components/admin/action-forms";
import { EmptyState } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { Pagination } from "@/components/ui/table";
import { replyTicketAction, setTicketStatusAction } from "@/lib/admin/actions";
import { listTickets } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support · Admin" };

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "PENDING", label: "Waiting on customer" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
  { value: "ALL", label: "All" },
];

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status ?? "ALL";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listTickets({ status, page });

  const buildHref = (next: number) => {
    const query = new URLSearchParams();
    if (status !== "ALL") query.set("status", status);
    if (next > 1) query.set("page", String(next));
    const suffix = query.toString();
    return suffix ? `/admin/tickets?${suffix}` : "/admin/tickets";
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-semibold tracking-tight">Support</h1>
          <p className="muted mt-1 text-[12.5px]">
            Customer and seller conversations. Replying assigns the ticket to you and moves an open
            ticket to waiting-on-customer.
          </p>
        </div>

        <form action="/admin/tickets" className="flex items-center gap-2">
          <label className="label mb-0" htmlFor="status">
            Status
          </label>
          <Select id="status" name="status" defaultValue={status} className="h-8 w-[190px]">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <button type="submit" className="btn btn-secondary btn-sm">
            Filter
          </button>
        </form>
      </header>

      <Card>
        <CardHeader
          title={`${result.total} ticket${result.total === 1 ? "" : "s"}`}
          description={`Showing page ${result.page} of ${result.totalPages}`}
        />

        {result.items.length === 0 ? (
          <EmptyState
            title="No tickets"
            description="No support tickets match this filter."
            icon={<LifeBuoy className="size-5" aria-hidden />}
          />
        ) : (
          <ul className="divide-y divide-line">
            {result.items.map((ticket) => (
              <li key={ticket.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11.5px] text-ink-muted">
                        {ticket.ticketNumber}
                      </span>
                      <span className="text-[13.5px] font-medium">{ticket.subject}</span>
                      <StatusBadge status={ticket.status} />
                      {ticket.priority !== "NORMAL" ? (
                        <StatusBadge status={ticket.priority} />
                      ) : null}
                    </div>
                    <p className="muted mt-1 text-[12px]">
                      {ticket.user.displayName} (@{ticket.user.username}) · {ticket.user.email}
                      {ticket.order ? ` · order ${ticket.order.orderNumber}` : ""}
                      {ticket.assignedTo ? ` · assigned to ${ticket.assignedTo.displayName}` : ""}
                    </p>
                    <p className="subtle mt-0.5 text-[11.5px]">
                      Opened {ticket.createdAt.toISOString().slice(0, 10)} · last activity{" "}
                      {ticket.updatedAt.toISOString().slice(0, 10)}
                      {ticket.closedAt
                        ? ` · closed ${ticket.closedAt.toISOString().slice(0, 10)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-start gap-2">
                    {ticket.status !== "RESOLVED" ? (
                      <ActionButton
                        action={setTicketStatusAction}
                        fields={{ ticketId: ticket.id, status: "RESOLVED" }}
                      >
                        Mark resolved
                      </ActionButton>
                    ) : null}
                    {ticket.status !== "CLOSED" ? (
                      <ActionButton
                        action={setTicketStatusAction}
                        fields={{ ticketId: ticket.id, status: "CLOSED" }}
                      >
                        Close
                      </ActionButton>
                    ) : null}
                    {ticket.status === "CLOSED" || ticket.status === "RESOLVED" ? (
                      <ActionButton
                        action={setTicketStatusAction}
                        fields={{ ticketId: ticket.id, status: "OPEN" }}
                      >
                        Reopen
                      </ActionButton>
                    ) : null}
                  </div>
                </div>

                {ticket.messages.length > 0 ? (
                  <ul className="space-y-1.5">
                    {ticket.messages.map((message) => (
                      <li
                        key={message.id}
                        className={
                          message.isStaff
                            ? "surface-elevated p-2.5"
                            : "rounded-[8px] border border-line/70 bg-canvas p-2.5"
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Badge tone={message.isStaff ? "accent" : "neutral"}>
                            {message.isStaff ? "staff" : "customer"}
                          </Badge>
                          <span className="subtle text-[11px]">
                            {message.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-[12.5px]">{message.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted text-[12px]">No messages on this ticket.</p>
                )}

                {ticket.status !== "CLOSED" ? (
                  <div className="max-w-2xl">
                    <TicketReplyForm action={replyTicketAction} ticketId={ticket.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pagination page={result.page} totalPages={result.totalPages} buildHref={buildHref} />
    </div>
  );
}
