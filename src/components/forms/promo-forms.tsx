"use client";

import { useActionState, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { idleState, type ActionState } from "@/lib/action-state";
import { formatMoney } from "@/lib/money";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

function Message({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Alert tone={state.status === "error" ? "error" : "success"}>{state.message}</Alert>;
}

const CURRENCIES = ["EUR", "USD", "GBP"];

export function CouponCreatorForm({
  action,
  submitLabel = "Create promo code",
  scopeHint,
}: {
  action: FormAction;
  submitLabel?: string;
  scopeHint?: string;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");

  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />
      {scopeHint ? <p className="muted text-[12.5px]">{scopeHint}</p> : null}

      <div className="grid gap-3.5 sm:grid-cols-4">
        <Field
          label="Promo code"
          htmlFor="coupon-code"
          error={state.fieldErrors?.code}
          hint="Letters, numbers, - or _."
        >
          <Input
            id="coupon-code"
            name="code"
            maxLength={32}
            placeholder="LAUNCH20"
            className="uppercase"
            required
          />
        </Field>

        <Field
          label="Discount type"
          htmlFor="coupon-type"
          error={state.fieldErrors?.discountType}
        >
          <Select
            id="coupon-type"
            name="discountType"
            value={discountType}
            onChange={(event) =>
              setDiscountType(event.target.value === "FIXED" ? "FIXED" : "PERCENT")
            }
          >
            <option value="PERCENT">Percentage (%)</option>
            <option value="FIXED">Fixed amount</option>
          </Select>
        </Field>

        <Field
          label={discountType === "PERCENT" ? "Percent off (1–100)" : "Amount off"}
          htmlFor="coupon-value"
          error={state.fieldErrors?.discountValue}
        >
          <Input
            id="coupon-value"
            name="discountValue"
            type="number"
            min={discountType === "PERCENT" ? 1 : 0.5}
            max={discountType === "PERCENT" ? 100 : 10000}
            step={discountType === "PERCENT" ? 1 : 0.01}
            placeholder={discountType === "PERCENT" ? "20" : "5.00"}
            required
          />
        </Field>

        <Field
          label="Currency"
          htmlFor="coupon-currency"
          error={state.fieldErrors?.currency}
          hint="Applies to fixed discounts & minimums."
        >
          <Select id="coupon-currency" name="currency" defaultValue="EUR">
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Field
          label="Minimum subtotal"
          htmlFor="coupon-min"
          error={state.fieldErrors?.minSubtotal}
          hint="Optional qualifying amount."
        >
          <Input
            id="coupon-min"
            name="minSubtotal"
            type="number"
            min={0}
            step="0.01"
            placeholder="Optional"
          />
        </Field>
        <Field
          label="Max redemptions"
          htmlFor="coupon-max"
          error={state.fieldErrors?.maxRedemptions}
          hint="Leave blank for unlimited."
        >
          <Input
            id="coupon-max"
            name="maxRedemptions"
            type="number"
            min={1}
            step={1}
            placeholder="Unlimited"
          />
        </Field>
        <Field
          label="Expires on"
          htmlFor="coupon-expires"
          error={state.fieldErrors?.expiresAt}
          hint="Optional cutoff date."
        >
          <Input id="coupon-expires" name="expiresAt" type="date" />
        </Field>
      </div>

      <Button type="submit" variant="primary" size="sm" disabled={pending}>
        {pending ? "Creating…" : submitLabel}
      </Button>
    </form>
  );
}

export function BundleCreatorForm({
  action,
  products,
}: {
  action: FormAction;
  products: Array<{
    id: string;
    title: string;
    priceMinor: number;
    salePriceMinor: number | null;
    currency: string;
  }>;
}) {
  const [state, formAction, pending] = useActionState(action, idleState);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedProducts = products.filter((item) => selectedIds.includes(item.id));
  const activeCurrency = selectedProducts[0]?.currency ?? products[0]?.currency ?? "EUR";
  const combinedMinor = selectedProducts.reduce(
    (sum, item) => sum + (item.salePriceMinor ?? item.priceMinor),
    0,
  );

  function toggleProduct(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <Message state={state} />
      <input type="hidden" name="currency" value={activeCurrency} />

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label="Bundle title" htmlFor="bundle-title" error={state.fieldErrors?.title}>
          <Input
            id="bundle-title"
            name="title"
            maxLength={100}
            placeholder="Creator Starter Pack"
            required
          />
        </Field>
        <Field
          label="Bundle URL"
          htmlFor="bundle-slug"
          error={state.fieldErrors?.slug}
          hint="Used at /bundle/your-slug."
        >
          <Input
            id="bundle-slug"
            name="slug"
            maxLength={100}
            placeholder="creator-starter-pack"
            required
          />
        </Field>
      </div>

      <Field
        label="Included products (pick 2 to 6)"
        error={state.fieldErrors?.productIds}
        hint="Selected products must share the same currency and be lower-priced together as a bundle."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {products.map((item) => {
            const checked = selectedIds.includes(item.id);
            const differentCurrency =
              selectedProducts.length > 0 && item.currency !== activeCurrency && !checked;
            const limitReached = selectedIds.length >= 6 && !checked;
            const unitPrice = item.salePriceMinor ?? item.priceMinor;

            return (
              <label
                key={item.id}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-[8px] border px-3 py-2 text-[12.5px] transition-colors ${
                  checked
                    ? "border-accent bg-accent-quiet/40 text-ink"
                    : differentCurrency || limitReached
                      ? "cursor-not-allowed border-line bg-elevated/40 opacity-50"
                      : "border-line bg-elevated/50 text-ink-muted hover:border-line-strong hover:text-ink"
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    name="productIds"
                    value={item.id}
                    checked={checked}
                    disabled={differentCurrency || limitReached}
                    onChange={() => toggleProduct(item.id)}
                    className="size-4 accent-accent"
                  />
                  <span className="truncate font-medium text-ink">{item.title}</span>
                </span>
                <span className="subtle shrink-0 tabular-nums">
                  {unitPrice === 0 ? "Free" : formatMoney(unitPrice, item.currency)}
                </span>
              </label>
            );
          })}
        </div>
      </Field>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field
          label={`Bundle price (${activeCurrency})`}
          htmlFor="bundle-price"
          error={state.fieldErrors?.price}
          hint={
            selectedProducts.length > 0
              ? `Combined individual total: ${formatMoney(combinedMinor, activeCurrency)}`
              : "Must be lower than the combined individual prices."
          }
        >
          <Input
            id="bundle-price"
            name="price"
            type="number"
            min={0.5}
            step="0.01"
            placeholder="29.00"
            required
          />
        </Field>
        <Field
          label="Short description (optional)"
          htmlFor="bundle-description"
          error={state.fieldErrors?.description}
        >
          <Textarea
            id="bundle-description"
            name="description"
            rows={2}
            maxLength={2000}
            placeholder="Everything needed to launch faster with one discounted bundle."
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="subtle text-[12px] tabular-nums">
          {selectedProducts.length}/6 products selected
          {selectedProducts.length > 0
            ? ` · regular value ${formatMoney(combinedMinor, activeCurrency)}`
            : ""}
        </p>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Publishing bundle…" : "Create bundle"}
        </Button>
      </div>
    </form>
  );
}
