"use client";

import { useState } from "react";
import { saveHolding } from "@/app/actions";
import { ASSET_CLASSES } from "@/lib/constants";
import { defaultCountsAsInvestment } from "@/lib/portfolio";
import type { HoldingRow } from "@/lib/types";
import { Check, ErrorNote, Field, SelectField, submitClass, useSubmit } from "./ui";

const SUBTYPES: Record<string, { id: string; label: string }[]> = {
  equity: [{ id: "stock", label: "Stock" }],
  mutual_fund: [{ id: "scheme", label: "Scheme" }],
  fd: [
    { id: "fd", label: "Fixed deposit" },
    { id: "rd", label: "Recurring deposit" },
  ],
  savings: [
    { id: "savings", label: "Savings account" },
    { id: "cash", label: "Cash on hand" },
  ],
  retirement: [
    { id: "epf", label: "EPF" },
    { id: "ppf", label: "PPF" },
    { id: "nps", label: "NPS" },
    { id: "other", label: "Other retirement" },
  ],
  gold: [
    { id: "physical", label: "Physical gold" },
    { id: "digital", label: "Digital gold" },
    { id: "sgb", label: "Sovereign Gold Bond" },
  ],
  real_estate: [
    { id: "residential", label: "Residential" },
    { id: "land", label: "Land" },
    { id: "commercial", label: "Commercial" },
  ],
  other_investment: [
    { id: "bond", label: "Bond" },
    { id: "gsec", label: "Government security" },
    { id: "reit", label: "REIT" },
    { id: "invit", label: "InvIT" },
    { id: "international", label: "International stock or ETF" },
    { id: "crypto", label: "Cryptocurrency" },
    { id: "other", label: "Other" },
  ],
  other_asset: [
    { id: "vehicle", label: "Vehicle" },
    { id: "loan_given", label: "Loan given" },
    { id: "business", label: "Business investment" },
    { id: "other", label: "Other asset" },
  ],
  liability: [
    { id: "credit_card", label: "Credit card outstanding" },
    { id: "home_loan", label: "Home loan" },
    { id: "personal_loan", label: "Personal loan" },
    { id: "other", label: "Other liability" },
  ],
};

export function HoldingForm({
  initial,
  onDone,
  quantityLocked = false,
  computedQuantity,
  computedAvgCost,
}: {
  initial?: HoldingRow | null;
  onDone: () => void;
  quantityLocked?: boolean;
  computedQuantity?: string | null;
  computedAvgCost?: string | null;
}) {
  const [assetClass, setAssetClass] = useState(initial?.assetClass || "equity");
  const { error, pending, onSubmit } = useSubmit(saveHolding, onDone);
  const row = initial;
  const subtypes = SUBTYPES[assetClass] || [];

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      {row?.id ? <input type="hidden" name="id" value={row.id} /> : null}
      <input type="hidden" name="flagsPresent" value="1" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Category" name="assetClass" defaultValue={assetClass} options={[...ASSET_CLASSES]} onChange={setAssetClass} />
        <SelectField label="Type" name="subtype" defaultValue={row?.subtype || subtypes[0]?.id} options={subtypes} key={assetClass} />
        <Field label="Name" name="name" defaultValue={row?.name} required />
        {assetClass === "equity" || assetClass === "mutual_fund" || assetClass === "other_investment" ? (
          <Field label={assetClass === "mutual_fund" ? "AMFI scheme code" : "Ticker"} name="ticker" defaultValue={row?.ticker} />
        ) : null}
        {assetClass === "equity" ? (
          <SelectField
            label="Exchange"
            name="exchange"
            defaultValue={row?.exchange || "NSE"}
            options={[
              { id: "NSE", label: "NSE" },
              { id: "BSE", label: "BSE" },
            ]}
          />
        ) : null}
        {assetClass === "equity" ? <Field label="Sector" name="sector" defaultValue={row?.sector} /> : null}
        {assetClass === "mutual_fund" ? (
          <SelectField
            label="Fund category"
            name="mfCategory"
            defaultValue={row?.mfCategory || "equity"}
            options={[
              { id: "equity", label: "Equity" },
              { id: "debt", label: "Debt" },
              { id: "hybrid", label: "Hybrid" },
              { id: "index", label: "Index" },
              { id: "other", label: "Other" },
            ]}
          />
        ) : null}
        {assetClass === "mutual_fund" ? (
          <Field label="Folio reference" name="accountRef" defaultValue={row?.accountRef} hint="Shown masked in tables. Do not enter a password, PIN, or OTP." />
        ) : null}
        {["fd", "savings", "retirement", "liability", "real_estate"].includes(assetClass) ? (
          <Field label="Bank or institution" name="institution" defaultValue={row?.institution} />
        ) : null}
        {["equity", "mutual_fund", "gold", "other_investment"].includes(assetClass) ? (
          <>
            {quantityLocked ? (
              <p className="text-sm sm:col-span-2">Quantity {computedQuantity || "—"} and average cost {computedAvgCost || "—"} come from the transaction history. Add a purchase or sale instead of editing them here.</p>
            ) : (
              <>
                <Field label={assetClass === "mutual_fund" ? "Units" : "Quantity"} name="quantity" defaultValue={row?.quantity} type="number" step="any" hint="With a purchase date, the first save records an opening lot. Add later purchases as transactions." />
                <Field label={assetClass === "mutual_fund" ? "Average NAV" : "Average purchase price"} name="avgCost" defaultValue={row?.avgCost} type="number" step="any" />
              </>
            )}
            <Field label={assetClass === "mutual_fund" ? "Current NAV" : "Current price"} name="currentPrice" defaultValue={row?.currentPrice} type="number" step="any" hint="Leave blank if you do not have a price. No price will be invented." />
          </>
        ) : null}
        {assetClass === "fd" ? (
          <>
            <Field label="Principal" name="avgCost" defaultValue={row?.avgCost} type="number" step="any" />
            <Field label="Interest rate % per year" name="interestRate" defaultValue={row?.interestRate} type="number" step="any" />
            <Field label="Start date" name="startDate" defaultValue={row?.startDate} type="date" />
            <Field label="Maturity date" name="maturityDate" defaultValue={row?.maturityDate} type="date" />
            <SelectField
              label="Compounding"
              name="compounding"
              defaultValue={row?.compounding || "quarterly"}
              options={[
                { id: "yearly", label: "Yearly" },
                { id: "half-yearly", label: "Half-yearly" },
                { id: "quarterly", label: "Quarterly" },
                { id: "monthly", label: "Monthly" },
              ]}
            />
            <SelectField
              label="Interest payout"
              name="payoutType"
              defaultValue={row?.payoutType || "cumulative"}
              options={[
                { id: "cumulative", label: "Cumulative" },
                { id: "at_maturity", label: "At maturity" },
                { id: "monthly", label: "Monthly payout" },
                { id: "quarterly", label: "Quarterly payout" },
                { id: "yearly", label: "Yearly payout" },
              ]}
            />
            <Field label="Entered maturity amount" name="maturityAmount" defaultValue={row?.maturityAmount} type="number" step="any" hint="Optional. If blank, maturity is a projection and labeled as an estimate." />
            <Field label="Entered accrued interest" name="accruedInterest" defaultValue={row?.accruedInterest} type="number" step="any" />
            <Field label="Entered current value" name="manualValue" defaultValue={row?.manualValue} type="number" step="any" hint="Optional. If blank, current value is projected from the rate and dates." />
            <SelectField
              label="Renewal status"
              name="renewalStatus"
              defaultValue={row?.renewalStatus || "active"}
              options={[
                { id: "active", label: "Active" },
                { id: "renewed", label: "Renewed" },
                { id: "matured", label: "Matured" },
                { id: "closed", label: "Closed" },
              ]}
            />
          </>
        ) : null}
        {assetClass === "savings" ? (
          <>
            <Field label="Current balance" name="manualValue" defaultValue={row?.manualValue} type="number" step="any" required />
            <Field label="Interest rate % if known" name="interestRate" defaultValue={row?.interestRate} type="number" step="any" />
          </>
        ) : null}
        {assetClass === "retirement" ? (
          <>
            <Field label="Employee contributions" name="employeeContribution" defaultValue={row?.employeeContribution} type="number" step="any" />
            <Field label="Employer contributions" name="employerContribution" defaultValue={row?.employerContribution} type="number" step="any" />
            <Field label="Current balance" name="manualValue" defaultValue={row?.manualValue} type="number" step="any" required />
            <Field label="Estimated annual return %" name="interestRate" defaultValue={row?.interestRate} type="number" step="any" hint="Stored as your estimate. It is not used as a guaranteed rate." />
            <Field label="Contribution frequency" name="contributionFrequency" defaultValue={row?.contributionFrequency} />
          </>
        ) : null}
        {assetClass === "real_estate" ? (
          <>
            <Field label="Purchase price" name="avgCost" defaultValue={row?.avgCost} type="number" step="any" />
            <Field label="Current estimated value" name="manualValue" defaultValue={row?.manualValue} type="number" step="any" required />
            <Field label="Outstanding property loan" name="outstandingLoan" defaultValue={row?.outstandingLoan} type="number" step="any" hint="Used only to estimate equity in this property. Add the loan under Liabilities if it should reduce net worth." />
            <Field label="Monthly rent received" name="rentalIncome" defaultValue={row?.rentalIncome} type="number" step="any" />
            <Field label="Monthly maintenance" name="monthlyCost" defaultValue={row?.monthlyCost} type="number" step="any" />
          </>
        ) : null}
        {assetClass === "other_asset" || assetClass === "gold" ? (
          <Field label="Current value if not priced per unit" name="manualValue" defaultValue={row?.manualValue} type="number" step="any" />
        ) : null}
        {assetClass === "other_asset" ? <Field label="Purchase cost" name="avgCost" defaultValue={row?.avgCost} type="number" step="any" /> : null}
        {assetClass === "liability" ? (
          <>
            <Field label="Outstanding balance" name="manualValue" defaultValue={row?.manualValue} type="number" step="any" required hint="Balance before recorded EMI and lump-sum payments. Those payments are subtracted when the outstanding is shown." />
            <Field label="Monthly EMI" name="monthlyCost" defaultValue={row?.monthlyCost} type="number" step="any" hint="The scheduled monthly payment. It reduces the balance only after you record each EMI." />
            <Field label="Lump sum (₹)" name="lumpSumAmount" type="number" step="any" hint="Optional prepayment saved with this loan. The full amount reduces the outstanding balance. Leave blank when you are only editing other details." />
            <Field label="Interest rate %" name="interestRate" defaultValue={row?.interestRate} type="number" step="any" />
          </>
        ) : null}
        {assetClass === "other_investment" ? (
          <>
            <Field label="Currency" name="currency" defaultValue={row?.currency || "INR"} />
            <Field label="Rupees per 1 unit of currency" name="fxRate" defaultValue={row?.fxRate || "1"} type="number" step="any" />
            <Field label="Current value override" name="manualValue" defaultValue={row?.manualValue} type="number" step="any" />
          </>
        ) : (
          <input type="hidden" name="currency" value={row?.currency || "INR"} />
        )}
        <Field label="Purchase or opening date" name="purchaseDate" defaultValue={row?.purchaseDate} type="date" />
        {assetClass === "mutual_fund" ? (
          <>
            <Field label="SIP amount" name="sipAmount" defaultValue={row?.sipAmount} type="number" step="any" />
            <Field label="Lump sum invested (₹)" name="lumpSumAmount" type="number" step="any" hint="Optional one-time purchase. Saved as a buy on the purchase date. Also enter the units and the price per unit above." />
            <SelectField
              label="SIP frequency"
              name="sipFrequency"
              defaultValue={row?.sipFrequency || ""}
              options={[
                { id: "", label: "None" },
                { id: "monthly", label: "Monthly" },
                { id: "quarterly", label: "Quarterly" },
              ]}
            />
            <Field label="SIP start" name="sipStart" defaultValue={row?.sipStart} type="date" />
          </>
        ) : null}
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Notes</span>
        <textarea name="notes" defaultValue={row?.notes} className="min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm" />
      </label>
      <div className="grid gap-2">
        <Check label="This value is an estimate I entered" name="isEstimate" defaultChecked={row?.isEstimate || assetClass === "real_estate"} />
        {assetClass !== "liability" && assetClass !== "savings" ? (
          <Check
            label="Count this in investable assets"
            name="countsAsInvestment"
            defaultChecked={row ? row.countsAsInvestment : defaultCountsAsInvestment(assetClass, "")}
          />
        ) : null}
        {assetClass === "real_estate" || assetClass === "other_asset" ? (
          <Check label="Personal-use asset (excluded from investable and financial views)" name="personalUse" defaultChecked={row?.personalUse} />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Passwords, PINs, and OTPs are not requested and should not be stored in notes.</p>
      <ErrorNote error={error} />
      <button className={submitClass(pending)} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
