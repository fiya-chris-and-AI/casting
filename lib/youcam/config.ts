function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const youcamConfig = {
  get apiKey() {
    return required("YOUCAM_API_KEY");
  },
  get baseUrl() {
    return process.env.YOUCAM_API_BASE_URL ?? "https://yce-api-01.perfectcorp.com";
  },
  get maxCallsPerRun() {
    return Number(process.env.YOUCAM_MAX_CALLS_PER_RUN ?? 8);
  },
  get requestTimeoutMs() {
    return Number(process.env.YOUCAM_REQUEST_TIMEOUT_SECONDS ?? 45) * 1000;
  },
  get demoMode() {
    return process.env.DEMO_MODE === "true";
  },
};
