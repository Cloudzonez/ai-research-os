import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["parse_pdf", "summarize_paper", "run_crawler", "build_embeddings", "generate_draft", "ingest_papers"],
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    error: String,
    retries: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    scheduledAt: { type: Date, default: null },
    startedAt: Date,
    completedAt: Date,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

jobSchema.index({ status: 1, scheduledAt: 1 });
jobSchema.index({ type: 1, status: 1 });

const Job = mongoose.model("Job", jobSchema);

export async function enqueue(type, payload = {}, options = {}) {
  return Job.create({
    type,
    payload,
    scheduledAt: options.scheduledAt || new Date(),
    maxRetries: options.maxRetries ?? 3,
    userId: options.userId || null,
  });
}

export async function dequeue(types, workerId) {
  const now = new Date();
  const job = await Job.findOneAndUpdate(
    {
      type: { $in: types },
      status: "pending",
      scheduledAt: { $lte: now },
      $expr: { $lt: ["$retries", "$maxRetries"] },
    },
    { status: "running", startedAt: now, $inc: { retries: 1 } },
    { sort: { scheduledAt: 1 }, new: true }
  );
  return job;
}

export async function completeJob(jobId, result) {
  return Job.findByIdAndUpdate(jobId, {
    status: "completed",
    result,
    completedAt: new Date(),
  });
}

export async function failJob(jobId, error) {
  const job = await Job.findById(jobId);
  if (!job) return null;

  if (job.retries >= job.maxRetries) {
    job.status = "failed";
    job.error = error;
    job.completedAt = new Date();
  } else {
    job.status = "pending";
    job.error = error;
    job.scheduledAt = new Date(Date.now() + 30000 * job.retries); // backoff
  }
  return job.save();
}

export async function getQueueStats() {
  const [pending, running, completed, failed] = await Promise.all([
    Job.countDocuments({ status: "pending" }),
    Job.countDocuments({ status: "running" }),
    Job.countDocuments({ status: "completed" }),
    Job.countDocuments({ status: "failed" }),
  ]);
  return { pending, running, completed, failed };
}

export default Job;
