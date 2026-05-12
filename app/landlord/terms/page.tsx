"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandlordTermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Terms &amp; conditions</h2>
        <p className="text-sm text-muted-foreground">
          Policy summary for tenant stays managed through DormConnect.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment &amp; removal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>
            Tenants may be removed <strong>five (5) calendar days</strong> after a
            payment due date if the balance remains unpaid, subject to applicable
            school rules and written notice where required.
          </p>
          <p>
            Deposits, advance rent, and remaining balances should be recorded in
            the Payments area. Supported methods include cash and GCash (and other
            methods your organization enables).
          </p>
          <p className="text-xs text-muted-foreground">
            This page summarizes operational policy for thesis documentation;
            consult your legal office for enforceable lease language.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
