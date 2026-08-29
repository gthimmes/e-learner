import { json } from "@/lib/api";
import { appUrl } from "@/lib/mail";

/** Minimal OpenAPI 3 description of the public REST API (v0.9 interop). */
export async function GET() {
  const courseSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      slug: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      status: { type: "string", enum: ["DRAFT", "PUBLISHED", "ARCHIVED"] },
      organizationId: { type: "string", nullable: true },
      instructor: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
      tags: { type: "array", items: { type: "string" } },
      level: { type: "string", enum: ["ALL", "BEGINNER", "INTERMEDIATE", "ADVANCED"] },
      priceCents: { type: "integer" },
      currency: { type: "string" },
      lessonCount: { type: "integer" },
      durationMin: { type: "integer" },
      enrollmentCount: { type: "integer" },
      rating: { type: "object", properties: { avg: { type: "number" }, count: { type: "integer" } } },
    },
  };
  return json({
    openapi: "3.0.3",
    info: { title: "e-learner API", version: "1.1.0", description: "Authenticate with `Authorization: Bearer elk_…` (create keys under Integrations)." },
    servers: [{ url: appUrl("/api/v1") }],
    components: { securitySchemes: { apiKey: { type: "http", scheme: "bearer" } }, schemas: { Course: courseSchema } },
    security: [{ apiKey: [] }],
    paths: {
      "/me": { get: { summary: "The user owning the API key", responses: { "200": { description: "User" } } } },
      "/courses": {
        get: {
          summary: "Courses visible to the caller (published; org-private courses only for members). Authors also see their drafts with `?mine=1`.",
          parameters: [
            { name: "mine", in: "query", schema: { type: "boolean" } },
            { name: "q", in: "query", schema: { type: "string" }, description: "Keyword search over title, summary, description and tags" },
            { name: "tag", in: "query", schema: { type: "string" } },
            { name: "level", in: "query", schema: { type: "string", enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] } },
            { name: "sort", in: "query", schema: { type: "string", enum: ["newest", "popular", "rating", "title"] } },
          ],
          responses: { "200": { description: "List", content: { "application/json": { schema: { type: "object", properties: { courses: { type: "array", items: { $ref: "#/components/schemas/Course" } } } } } } } },
        },
      },
      "/paths": {
        get: { summary: "Published learning paths visible to the caller, with ordered course ids", responses: { "200": { description: "{ paths: [...] }" } } },
      },
      "/courses/{courseId}": {
        get: { summary: "Course with full outline (modules and lessons)", parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Course" }, "404": { description: "Not found" } } },
      },
      "/courses/{courseId}/enrollments": {
        get: { summary: "Learners and progress (course editors only)", parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Enrollments" } } },
        post: {
          summary: "Enroll an existing user by email (course editors only)",
          parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string" }, cohortId: { type: "string" } } } } } },
          responses: { "201": { description: "Enrolled" }, "200": { description: "Already enrolled" }, "404": { description: "User or course not found" } },
        },
      },
      "/courses/{courseId}/xapi": {
        get: { summary: "xAPI statements for all activity in the course (course editors only)", parameters: [{ name: "courseId", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "{ statements: [...] }" } } },
      },
    },
    "x-webhooks": {
      description: "Configure under Integrations. POST JSON with headers X-Elearner-Event and X-Elearner-Signature (sha256 HMAC of the body).",
      events: ["enrollment.created", "lesson.completed", "course.completed", "quiz.attempted", "quiz.graded", "webhook.test"],
    },
  });
}
