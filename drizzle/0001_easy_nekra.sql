CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`business` text NOT NULL,
	`contact` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`sku` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`pack` text NOT NULL,
	`price_cents` integer NOT NULL,
	`stock` integer NOT NULL,
	`published` integer NOT NULL,
	`updated_at` integer NOT NULL
);
