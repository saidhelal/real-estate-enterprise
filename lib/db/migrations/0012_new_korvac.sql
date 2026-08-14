--> Removes the customer-portal access tables.
-->
--> The portal is gone: customers are business records staff manage inside the
--> ERP and no customer holds a login, so nothing can write to these again.
--> All six were empty and no foreign key referenced them, verified before this
--> was generated. Customer business data is untouched — customers, leads,
--> contracts, and the customer-service records (support_tickets, complaints,
--> maintenance_requests and their ticket threads) all stay.
DROP TABLE "customer_device_tokens" CASCADE;--> statement-breakpoint
DROP TABLE "customer_notifications" CASCADE;--> statement-breakpoint
DROP TABLE "customer_otps" CASCADE;--> statement-breakpoint
DROP TABLE "customer_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "customer_uploads" CASCADE;--> statement-breakpoint
DROP TABLE "customer_users" CASCADE;