"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

type InspectionSchedule = {
	accreditationRequestId: string;
	dormName: string;
	ownerName: string;
	scheduledFor: string | null;
	scheduleStatus: "upcoming" | "completed" | "overdue";
	result: string | null;
};

type InspectionData = {
	summary: {
		recommended: number;
		rejected: number;
		onHold: number;
		upcoming: number;
	};
	schedules: InspectionSchedule[];
};

function scheduleLabel(status: InspectionSchedule["scheduleStatus"]) {
	if (status === "completed") return "Completed";
	if (status === "overdue") return "Overdue";
	return "Scheduled";
}

export default function StaffDashboardPage() {
	const [data, setData] = useState<InspectionData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/osa/inspections", { credentials: "include" });
			const json = (await res.json()) as InspectionData & { error?: string };
			if (!res.ok) throw new Error(json.error ?? "Failed to load inspections");
			setData(json);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load inspections");
			setData(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const upcoming = (data?.schedules ?? [])
		.filter((item) => item.scheduleStatus === "upcoming" || item.scheduleStatus === "overdue")
		.sort((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""))
		.slice(0, 6);

	const metrics = [
		{ label: "Upcoming / overdue", value: data?.summary.upcoming ?? 0, tone: "text-sky-700" },
		{ label: "Completed", value: data?.schedules.filter((item) => item.scheduleStatus === "completed").length ?? 0, tone: "text-slate-700" },
		{ label: "On hold", value: data?.summary.onHold ?? 0, tone: "text-amber-700" },
		{ label: "Recommended", value: data?.summary.recommended ?? 0, tone: "text-emerald-700" },
	];

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Staff Dashboard</h1>
					<p className="text-sm text-muted-foreground">Inspection workload and recent schedule activity.</p>
				</div>
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
						{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
						Refresh
					</Button>
					<Button asChild size="sm">
						<Link href="/staff/inspections">
							Inspections <ArrowRight className="ml-2 h-4 w-4" />
						</Link>
					</Button>
				</div>
			</div>

			{error && (
				<div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>
			)}

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				{metrics.map((metric) => (
					<Card key={metric.label} className="border border-gray-300 bg-white">
						<CardHeader className="pb-1">
							<CardTitle className="text-xs font-medium text-muted-foreground">{metric.label}</CardTitle>
						</CardHeader>
						<CardContent className="pt-0">
							<p className={`text-2xl font-semibold ${metric.tone}`}>{loading ? "—" : metric.value}</p>
						</CardContent>
					</Card>
				))}
			</section>

			<Card className="border border-gray-300 bg-white">
				<CardHeader className="flex flex-row items-center justify-between gap-3 border-b bg-muted/40 pb-3">
					<div>
						<CardTitle className="text-sm font-semibold text-slate-800">Next inspections</CardTitle>
						<p className="text-xs text-muted-foreground">Upcoming and overdue visits requiring staff attention.</p>
					</div>
					<Link href="/staff/inspections" className="text-xs font-medium text-sky-700 hover:underline">View all</Link>
				</CardHeader>
				<CardContent className="pt-0">
					<Table bordered={false}>
						<TableHeader>
							<TableRow>
								<TableHead>Dormitory</TableHead>
								<TableHead>Landlord</TableHead>
								<TableHead>Date</TableHead>
								<TableHead>Schedule</TableHead>
								<TableHead>Result</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{!loading && upcoming.length === 0 && (
								<TableRow>
									<TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
										No upcoming inspections.
									</TableCell>
								</TableRow>
							)}
							{upcoming.map((item) => (
								<TableRow key={item.accreditationRequestId}>
									<TableCell className="text-sm font-medium">{item.dormName}</TableCell>
									<TableCell className="text-xs">{item.ownerName}</TableCell>
									<TableCell className="text-xs">{item.scheduledFor ?? "—"}</TableCell>
									<TableCell>
										<Badge variant="outline">{scheduleLabel(item.scheduleStatus)}</Badge>
									</TableCell>
									<TableCell className="text-xs">{item.result ?? "Pending"}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</div>
	);
}
