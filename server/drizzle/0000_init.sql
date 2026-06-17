CREATE SCHEMA "elearning";
--> statement-breakpoint
CREATE TYPE "elearning"."coupon_scope" AS ENUM('course', 'platform');--> statement-breakpoint
CREATE TYPE "elearning"."coupon_type" AS ENUM('percent', 'flat');--> statement-breakpoint
CREATE TYPE "elearning"."course_level" AS ENUM('beginner', 'intermediate', 'advanced', 'all');--> statement-breakpoint
CREATE TYPE "elearning"."course_status" AS ENUM('draft', 'review', 'published', 'unpublished', 'rejected');--> statement-breakpoint
CREATE TYPE "elearning"."enrollment_source" AS ENUM('purchase', 'free', 'gift', 'admin');--> statement-breakpoint
CREATE TYPE "elearning"."lecture_type" AS ENUM('video', 'article', 'quiz', 'assignment');--> statement-breakpoint
CREATE TYPE "elearning"."order_status" AS ENUM('pending', 'paid', 'failed', 'refunded');--> statement-breakpoint
CREATE TABLE "elearning"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(80) NOT NULL,
	"target" varchar(120),
	"meta" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_user_course_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "elearning"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"parent_id" uuid,
	"description" text,
	"icon" varchar(64),
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "elearning"."certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"serial" varchar(40) NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verify_url" text
);
--> statement-breakpoint
CREATE TABLE "elearning"."coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(40) NOT NULL,
	"scope" "elearning"."coupon_scope" DEFAULT 'course' NOT NULL,
	"type" "elearning"."coupon_type" DEFAULT 'percent' NOT NULL,
	"value" integer NOT NULL,
	"max_uses" integer,
	"used" integer DEFAULT 0 NOT NULL,
	"course_id" uuid,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "elearning"."courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"subtitle" varchar(255),
	"slug" varchar(240) NOT NULL,
	"description" text,
	"category_id" uuid,
	"subcategory_id" uuid,
	"topics" text[] DEFAULT ARRAY[]::text[],
	"level" "elearning"."course_level" DEFAULT 'all' NOT NULL,
	"language" varchar(40) DEFAULT 'English' NOT NULL,
	"image" text,
	"promo_video" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "elearning"."course_status" DEFAULT 'draft' NOT NULL,
	"rating_avg" integer DEFAULT 0 NOT NULL,
	"rating_count" integer DEFAULT 0 NOT NULL,
	"students_count" integer DEFAULT 0 NOT NULL,
	"duration_total_sec" integer DEFAULT 0 NOT NULL,
	"learning_objectives" text[] DEFAULT ARRAY[]::text[],
	"requirements" text[] DEFAULT ARRAY[]::text[],
	"target_audience" text[] DEFAULT ARRAY[]::text[],
	"rejection_note" text,
	"featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "courses_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "elearning"."earning_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"gross_cents" integer DEFAULT 0 NOT NULL,
	"fee_cents" integer DEFAULT 0 NOT NULL,
	"net_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"source" "elearning"."enrollment_source" DEFAULT 'purchase' NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_user_course_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "elearning"."instructor_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"payout_method" jsonb DEFAULT '{}'::jsonb,
	"tax_info" jsonb DEFAULT '{}'::jsonb,
	"revenue_share_pct" integer DEFAULT 50 NOT NULL,
	"total_students" integer DEFAULT 0 NOT NULL,
	"avg_rating" integer DEFAULT 0 NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."lectures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"type" "elearning"."lecture_type" DEFAULT 'video' NOT NULL,
	"video_url" text,
	"article_body" text,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"is_free_preview" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lecture_id" uuid NOT NULL,
	"timestamp_sec" integer DEFAULT 0 NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(60) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"instructor_id" uuid NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"platform_fee_cents" integer DEFAULT 0 NOT NULL,
	"instructor_earning_cents" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subtotal_cents" integer DEFAULT 0 NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"tax_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" "elearning"."order_status" DEFAULT 'pending' NOT NULL,
	"coupon_code" varchar(40),
	"provider" varchar(20) DEFAULT 'mock' NOT NULL,
	"payment_ref" varchar(120),
	"invoice_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"lecture_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"last_position_sec" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "progress_enrollment_lecture_unique" UNIQUE("enrollment_id","lecture_id")
);
--> statement-breakpoint
CREATE TABLE "elearning"."qna" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecture_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"question" text NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."qna_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qna_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"type" varchar(16) DEFAULT 'single' NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"explanation" text,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecture_id" uuid NOT NULL,
	"title" varchar(200) DEFAULT 'Quiz' NOT NULL,
	"pass_pct" integer DEFAULT 70 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lecture_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"file_url" text NOT NULL,
	"type" varchar(40)
);
--> statement-breakpoint
CREATE TABLE "elearning"."reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"body" text,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"instructor_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_course_user_unique" UNIQUE("course_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "elearning"."sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "elearning"."topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "elearning"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"avatar" text,
	"headline" varchar(255),
	"bio" text,
	"links" jsonb DEFAULT '{}'::jsonb,
	"roles" text[] DEFAULT ARRAY['student']::text[] NOT NULL,
	"locale" varchar(12) DEFAULT 'en' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "elearning"."wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_user_course_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
ALTER TABLE "elearning"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "elearning"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."cart_items" ADD CONSTRAINT "cart_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "elearning"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "elearning"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."certificates" ADD CONSTRAINT "certificates_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "elearning"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."coupons" ADD CONSTRAINT "coupons_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "elearning"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."courses" ADD CONSTRAINT "courses_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."courses" ADD CONSTRAINT "courses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "elearning"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."courses" ADD CONSTRAINT "courses_subcategory_id_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "elearning"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."earning_transactions" ADD CONSTRAINT "earning_transactions_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."earning_transactions" ADD CONSTRAINT "earning_transactions_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "elearning"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "elearning"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."instructor_profiles" ADD CONSTRAINT "instructor_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."lectures" ADD CONSTRAINT "lectures_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "elearning"."sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."lectures" ADD CONSTRAINT "lectures_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "elearning"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."notes" ADD CONSTRAINT "notes_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "elearning"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "elearning"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."order_items" ADD CONSTRAINT "order_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "elearning"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."order_items" ADD CONSTRAINT "order_items_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."progress" ADD CONSTRAINT "progress_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "elearning"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."progress" ADD CONSTRAINT "progress_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "elearning"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."qna" ADD CONSTRAINT "qna_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "elearning"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."qna" ADD CONSTRAINT "qna_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "elearning"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."qna" ADD CONSTRAINT "qna_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."qna_answers" ADD CONSTRAINT "qna_answers_qna_id_qna_id_fk" FOREIGN KEY ("qna_id") REFERENCES "elearning"."qna"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."qna_answers" ADD CONSTRAINT "qna_answers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "elearning"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."quizzes" ADD CONSTRAINT "quizzes_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "elearning"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."resources" ADD CONSTRAINT "resources_lecture_id_lectures_id_fk" FOREIGN KEY ("lecture_id") REFERENCES "elearning"."lectures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."reviews" ADD CONSTRAINT "reviews_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "elearning"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."sections" ADD CONSTRAINT "sections_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "elearning"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "elearning"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elearning"."wishlist_items" ADD CONSTRAINT "wishlist_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "elearning"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "courses_instructor_idx" ON "elearning"."courses" USING btree ("instructor_id");--> statement-breakpoint
CREATE INDEX "courses_status_idx" ON "elearning"."courses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "courses_category_idx" ON "elearning"."courses" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "enrollments_user_idx" ON "elearning"."enrollments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "enrollments_course_idx" ON "elearning"."enrollments" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "lectures_section_idx" ON "elearning"."lectures" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "lectures_course_idx" ON "elearning"."lectures" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "reviews_course_idx" ON "elearning"."reviews" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "sections_course_idx" ON "elearning"."sections" USING btree ("course_id");