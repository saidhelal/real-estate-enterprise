--> The approved business policies, in the columns they need.
-->
--> Supplier evaluation was weighted across five criteria but the register
--> carried four scores, so the tenth of the result that belongs to safety,
--> documents and compliance had nowhere to live.
-->
--> Vehicle servicing is due at six months or at a distance or running-hours
--> limit, whichever comes first. Those two limits belong to the machine, not
--> to the company, so they sit on the vehicle. All four columns are nullable:
--> a vehicle with no distance rule is governed by the six-month rule alone,
--> and nothing here invents a figure for one.
-->
--> Additive only. No existing value is read, written or dropped.
ALTER TABLE "supplier_evaluations" ADD COLUMN "compliance_score" numeric;--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "current_operating_hours" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "service_interval_km" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "vehicles" ADD COLUMN "service_interval_hours" numeric(12, 2);